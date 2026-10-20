import type { ChatResponseChunk, Puter } from '@heyputer/puter.js';
import type {
  GenerationMode,
  GenerationRequest,
  GenerationEvent,
  GenerationResult,
  ITranslationGenerationTransport,
} from '../shared/ITranslationGenerationTransport';
import { classifyGenerationError } from '../shared/generation-errors';
import { isConfigurationRejection } from '../shared/generation-configuration-error';
import { throwIfAborted } from '../shared/translation-execution';
import { withPuterSession } from './PuterSdkSession';
import { responseText, mapPuterError } from './puter-errors';
import { thinkingConfigurations } from '../shared/thinking-configurations';
import type { ThinkingConfiguration } from '../shared/generation-configurations';
import { ErrorCode } from '../../../shared/errors';

type GenerationObserver = (event: GenerationEvent) => Promise<void>;

export class PuterGenerationTransport implements ITranslationGenerationTransport {
  readonly configurations: readonly ThinkingConfiguration[];
  readonly supportedModes: readonly GenerationMode[] = [
    'plain-stream',
    'plain-buffered',
  ];

  constructor(
    private readonly token: string,
    private readonly model: string,
  ) {
    this.configurations = thinkingConfigurations({
      provider: 'puter',
      modelId: model,
    });
  }

  async generate(
    request: GenerationRequest,
    onEvent: GenerationObserver,
  ): Promise<GenerationResult> {
    const configuration =
      this.configurations.find(
        (candidate) => candidate.id === request.configurationId,
      ) ??
      (request.configurationId === undefined
        ? this.configurations[0]
        : undefined);
    if (!configuration) throw new Error('Unknown generation configuration');
    try {
      return await withPuterSession(
        this.token,
        (sdk) => {
          const prompt = request.instructions + '\n\n' + request.userText;
          return request.mode === 'plain-stream'
            ? this.generateStream(sdk, request, prompt, onEvent, configuration)
            : this.generateBuffered(sdk, request, prompt, configuration);
        },
        request.signal,
      );
    } catch (error) {
      throwIfAborted(request.signal);
      const mapped = mapPuterError(error);
      // Puter may report usage limits only in native metadata.
      if (mapped.code === ErrorCode.TRANSLATION_PROVIDER_QUOTA_EXCEEDED)
        throw mapped;
      if (
        classifyGenerationError(error, request.mode).unsupported ||
        isConfigurationRejection(error, configuration.rejectionFields)
      )
        throw error;

      throw mapped;
    }
  }

  private async generateBuffered(
    sdk: Puter,
    request: GenerationRequest,
    prompt: string,
    configuration: ThinkingConfiguration,
  ): Promise<GenerationResult> {
    const response = await sdk.ai.chat(prompt, request.image.value, {
      model: this.model,
      temperature: 0,
      ...(configuration.puterEffort === undefined
        ? {}
        : { reasoning_effort: configuration.puterEffort }),
      normalize: true,
    });

    throwIfAborted(request.signal);

    return {
      text: responseText(response),
      finishReason: normalizeFinishReason(response.finish_reason),
      schemaValidated: false,
    };
  }

  private async generateStream(
    sdk: Puter,
    request: GenerationRequest,
    prompt: string,
    onEvent: GenerationObserver,
    configuration: ThinkingConfiguration,
  ): Promise<GenerationResult> {
    const stream = await sdk.ai.chat(prompt, request.image.value, {
      model: this.model,
      temperature: 0,
      ...(configuration.puterEffort === undefined
        ? {}
        : { reasoning_effort: configuration.puterEffort }),
      stream: true,
    });
    const iterator = stream[Symbol.asyncIterator]();
    const cleanup = () => requestIteratorCleanup(iterator);

    request.signal.addEventListener('abort', cleanup, { once: true });

    if (request.signal.aborted) cleanup();

    let text = '';
    try {
      // Keep the SDK lease until a cancelled native iterator really settles.
      for await (const part of { [Symbol.asyncIterator]: () => iterator }) {
        if (request.signal.aborted) continue;
        if (part.type === 'error') throw part;
        if (part.type !== 'text' || typeof part.text !== 'string') continue;
        text += part.text;
        await onEvent({ type: 'text', text: part.text });
      }
    } finally {
      request.signal.removeEventListener('abort', cleanup);
    }
    throwIfAborted(request.signal);
    return { text, finishReason: 'stop', schemaValidated: false };
  }
}

function requestIteratorCleanup(
  iterator: AsyncIterator<ChatResponseChunk>,
): void {
  try {
    void Promise.resolve(iterator.return?.()).catch(() => {});
  } catch {
    // Logical cancellation remains authoritative if native cleanup fails.
  }
}

function normalizeFinishReason(reason?: string): string {
  switch (reason) {
    case 'content_filter':
      return 'content-filter';
    case 'end_turn':
      return 'stop';
    case 'max_tokens':
      return 'length';
    default:
      return reason ?? 'stop';
  }
}
