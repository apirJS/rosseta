import {
  generateText,
  streamText,
  Output,
  NoObjectGeneratedError,
  type LanguageModel,
} from "ai";
import type {
  GenerationEvent,
  GenerationMode,
  GenerationRequest,
  GenerationResult,
  ITranslationGenerationTransport,
} from "./ITranslationGenerationTransport";
import { isStreamed, isStructured } from "./translation-fallback";
import { raceAbort } from "./translation-execution";
import { unwrapGenerationError } from "./generation-errors";
import { thinkingConfigurations } from "./thinking-configurations";
import {
  PROVIDER_DEFAULT_CONFIGURATION,
  type ConfiguredModelFactory,
  type SdkProviderOptions,
  type ThinkingConfiguration,
  type ThinkingContext,
} from "./generation-configurations";

export type { SdkProviderOptions } from "./generation-configurations";

interface TransportOptions {
  providerOptions?: SdkProviderOptions;
  structuredProviderOptions?: SdkProviderOptions;
  supportedModes?: readonly GenerationMode[];
  configurations?: readonly ThinkingConfiguration[];
  thinkingContext?: ThinkingContext;
  createModel?: ConfiguredModelFactory;
}

type SdkGenerationOptions = ReturnType<typeof createGenerationOptions>;
type SdkStreamResult = ReturnType<typeof streamText>;
type GenerationObserver = (event: GenerationEvent) => Promise<void>;
type ObservedOutput = { output: unknown } | { error: unknown };

export class AiSdkGenerationTransport implements ITranslationGenerationTransport {
  readonly legacyModelKey?: string;
  readonly supportedModes?: readonly GenerationMode[];
  readonly configurations: readonly ThinkingConfiguration[];

  constructor(
    private readonly model: LanguageModel,
    private readonly options: TransportOptions = {},
  ) {
    this.supportedModes = options.supportedModes;
    const context =
      typeof model === "object"
        ? {
            provider: model.provider.replace(/\.[^.]+$/, "").toLowerCase(),
            modelId: model.modelId,
          }
        : { provider: "", modelId: model };

    this.configurations =
      options.configurations ??
      thinkingConfigurations(options.thinkingContext ?? context);

    if (typeof model === "object")
      this.legacyModelKey = model.provider + ":" + model.modelId;
  }

  async generate(
    request: GenerationRequest,
    onEvent: GenerationObserver,
  ): Promise<GenerationResult> {
    const controller = new AbortController();
    const signal = AbortSignal.any([request.signal, controller.signal]);
    const configuration = this.configurationFor(request.configurationId);
    const model = this.options.createModel?.(configuration) ?? this.model;
    const options = createGenerationOptions(
      model,
      request,
      signal,
      this.options,
      configuration,
    );
    const structured = isStructured(request.mode);

    return isStreamed(request.mode)
      ? this.generateStream(options, structured, onEvent, controller)
      : this.generateBuffered(options, structured);
  }

  private configurationFor(id: string | undefined): ThinkingConfiguration {
    if (id === undefined)
      return this.configurations[0] ?? PROVIDER_DEFAULT_CONFIGURATION;

    const configuration = this.configurations.find(
      (candidate) => candidate.id === id,
    );

    if (!configuration) throw new Error("Unknown generation configuration");
    return configuration;
  }

  private async generateBuffered(
    options: SdkGenerationOptions,
    structured: boolean,
  ): Promise<GenerationResult> {
    try {
      const generated = await generateText(options);
      return {
        text: generated.text,
        output: structured ? generated.output : undefined,
        finishReason: generated.finishReason,
        schemaValidated: structured,
      };
    } catch (error) {
      const recovered = recoverSchemaRejection(unwrapGenerationError(error));
      if (recovered) return recovered;

      throw error;
    }
  }

  private async generateStream(
    options: SdkGenerationOptions,
    structured: boolean,
    onEvent: GenerationObserver,
    controller: AbortController,
  ): Promise<GenerationResult> {
    let firstError: unknown;
    const recordError = (error: unknown) => {
      firstError ??= error;
    };

    const result = streamText({
      ...options,
      onError: ({ error }) => recordError(error),
    });

    // Observe the final-output promise before pumping either stream branch so a
    // schema rejection cannot become an unhandled promise rejection.
    const finalOutput = observeFinalOutput(result, structured);
    const textPump = consumeTextStream(
      result.stream,
      options.abortSignal,
      onEvent,
      recordError,
    );

    const partialPump = structured
      ? consumePartialOutput(result.partialOutputStream, onEvent)
      : Promise.resolve();

    try {
      const [text] = await raceAbort(
        Promise.all([textPump, partialPump]),
        options.abortSignal,
      );

      if (firstError) throw firstError;

      const finishReason = await result.finishReason;
      const final = await finalOutput;

      if ("error" in final) {
        const error = unwrapGenerationError(final.error);
        const recovered = recoverSchemaRejection(error, text, finishReason);
        if (recovered) return recovered;
        throw error;
      }

      return {
        text,
        output: final.output,
        finishReason,
        schemaValidated: structured,
      };
    } catch (error) {
      controller.abort(error);
      void Promise.allSettled([textPump, partialPump, finalOutput]);
      throw error;
    }
  }
}

function createGenerationOptions(
  model: LanguageModel,
  request: GenerationRequest,
  signal: AbortSignal,
  options: TransportOptions,
  configuration: ThinkingConfiguration,
) {
  return {
    model,
    instructions: request.instructions,
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: request.userText },
          {
            type: "file" as const,
            data: { type: "data" as const, data: request.image.base64Data },
            mediaType: request.image.mimeType,
          },
        ],
      },
    ],
    temperature: 0,
    ...(configuration.reasoning === undefined
      ? {}
      : { reasoning: configuration.reasoning }),
    maxRetries: 0,
    abortSignal: signal,
    providerOptions: mergeProviderOptions(
      mergeProviderOptions(
        options.providerOptions,
        configuration.providerOptions,
      ),
      isStructured(request.mode)
        ? options.structuredProviderOptions
        : undefined,
    ),
    ...(isStructured(request.mode)
      ? { output: Output.object({ schema: request.schema }) }
      : {}),
  };
}

function mergeProviderOptions(
  common: SdkProviderOptions | undefined,
  structured: SdkProviderOptions | undefined,
): SdkProviderOptions | undefined {
  if (!common) return structured;
  if (!structured) return common;
  return Object.fromEntries(
    [...new Set([...Object.keys(common), ...Object.keys(structured)])].map(
      (namespace) => [
        namespace,
        { ...common[namespace], ...structured[namespace] },
      ],
    ),
  );
}

function observeFinalOutput(
  result: SdkStreamResult,
  structured: boolean,
): Promise<ObservedOutput> {
  if (!structured) return Promise.resolve({ output: undefined });
  return Promise.resolve(result.output).then(
    (output) => ({ output }),
    (error) => ({ error }),
  );
}

async function consumeTextStream(
  stream: SdkStreamResult["stream"],
  signal: AbortSignal,
  onEvent: GenerationObserver,
  recordError: (error: unknown) => void,
): Promise<string> {
  let text = "";
  for await (const part of stream) {
    switch (part.type) {
      case "error":
        recordError(part.error);
        break;
      case "abort":
        recordError(signal.reason ?? new Error("Stream aborted"));
        break;
      case "text-delta":
        text += part.text;
        await onEvent({ type: "text", text: part.text });
        break;
    }
  }
  return text;
}

async function consumePartialOutput(
  stream: SdkStreamResult["partialOutputStream"],
  onEvent: GenerationObserver,
): Promise<void> {
  for await (const value of stream) await onEvent({ type: "partial", value });
}

function recoverSchemaRejection(
  error: unknown,
  accumulated = "",
  finishReason?: string,
): GenerationResult | null {
  if (!NoObjectGeneratedError.isInstance(error)) return null;
  return {
    text: accumulated || error.text || "",
    finishReason: finishReason ?? error.finishReason ?? "stop",
    schemaValidated: false,
    validationError: error,
  };
}
