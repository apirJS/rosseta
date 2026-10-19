import type { ChatResponseChunk, Puter } from '@heyputer/puter.js';
import type {
  GenerationMode,
  GenerationRequest,
  GenerationEvent,
  GenerationResult,
  ITranslationGenerationTransport,
} from '../shared/ITranslationGenerationTransport';
import { classifyGenerationError } from '../shared/generation-errors';
import { throwIfAborted } from '../shared/translation-execution';
import { withPuterSession } from './PuterSdkSession';
import { responseText, mapPuterError } from './puter-errors';

type GenerationObserver = (event: GenerationEvent) => Promise<void>;

export class PuterGenerationTransport implements ITranslationGenerationTransport {
  readonly supportedModes: readonly GenerationMode[] = [
    'plain-stream',
    'plain-buffered',
  ];

  constructor(
    private readonly token: string,
    private readonly model: string,
  ) {}

  async generate(
    request: GenerationRequest,
    onEvent: GenerationObserver,
  ): Promise<GenerationResult> {
    try {
      return await withPuterSession(
        this.token,
        (sdk) => {
          const prompt = request.instructions + '\n\n' + request.userText;
          return request.mode === 'plain-stream'
            ? this.generateStream(sdk, request, prompt, onEvent)
            : this.generateBuffered(sdk, request, prompt);
        },
        request.signal,
      );
    } catch (error) {
      throwIfAborted(request.signal);
      if (classifyGenerationError(error, request.mode).unsupported) throw error;

      throw mapPuterError(error);
    }
  }

  private async generateBuffered(
    sdk: Puter,
    request: GenerationRequest,
    prompt: string,
  ): Promise<GenerationResult> {
    const response = await sdk.ai.chat(prompt, request.image.value, {
      model: this.model,
      temperature: 0,
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
  ): Promise<GenerationResult> {
    const stream = await sdk.ai.chat(prompt, request.image.value, {
      model: this.model,
      temperature: 0,
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
