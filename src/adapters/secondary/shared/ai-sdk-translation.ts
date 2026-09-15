import {
  generateText,
  Output,
  APICallError,
  NoOutputGeneratedError,
  NoObjectGeneratedError,
  type LanguageModel,
} from 'ai';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import type { IStructuredOutputExemptionStorage } from '../../../core/ports/outbound/IStructuredOutputExemptionStorage';
import { failure, type Result } from '../../../shared/types/Result';
import {
  AppError,
  NetworkError,
  TranslationError,
} from '../../../shared/errors';
import { mapResponseToDomain } from './translation-response-mapper';
import { buildBasePrompt } from './prompt-base';
import {
  translationDataSchema,
  type TranslationSchemaOutput,
} from './translation-schema';
import { parseTranslationResponse } from './parse-translation-json';

const REQUEST_TIMEOUT_MS = 30_000;

const VISION_REJECTION_PATTERNS: RegExp[] = [
  /content must be a string/i,
  /not (?:a )?(?:multimodal|vision)/i,
  /(?:multimodal|vision) (?:support|capabilit)/i,
  /only supports text/i,
  /unsupported content type/i,
  /image/i,
];

const RESPONSE_FORMAT_UNSUPPORTED_PATTERNS: RegExp[] = [
  /does not support (?:the )?response format/i,
  /response.?format .{0,60}(?:not supported|unsupported)/i,
  /json_schema .{0,60}(?:not supported|unsupported)/i,
  /(?:not supported|unsupported).{0,60}json_schema/i,
  /json_schema/i,
];

function isVisionRejection(message: string): boolean {
  return VISION_REJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

function isResponseFormatUnsupported(message: string): boolean {
  return RESPONSE_FORMAT_UNSUPPORTED_PATTERNS.some((pattern) =>
    pattern.test(message),
  );
}

function modelCacheKey(model: LanguageModel): string | null {
  if (typeof model !== 'object' || model === null) return null;
  if (!('provider' in model) || !('modelId' in model)) return null;
  return `${model.provider}:${model.modelId}`;
}

function interpretParsedTranslation(
  parsed: Result<TranslationSchemaOutput, AppError>,
  targetLanguage: Language,
  tag: string,
): Result<Translation, AppError> {
  if (!parsed.success) {
    return failure(TranslationError.malformedResponse());
  }

  if (!parsed.data.success || !parsed.data.data) {
    console.error(
      `[${tag}] AI rejected translation:`,
      parsed.data.error ?? 'Unknown error',
    );
    return failure(
      TranslationError.aiRejected(parsed.data.error ?? 'Unknown error'),
    );
  }

  return mapResponseToDomain(parsed.data.data, targetLanguage, tag);
}

function mapGenerationError(
  error: unknown,
  tag: string,
): Result<Translation, AppError> {
  if (error instanceof AppError) {
    return failure(error);
  }

  if (NoOutputGeneratedError.isInstance(error)) {
    console.error(`[${tag}] Response failed schema validation:`, error.cause);
    return failure(TranslationError.malformedResponse());
  }

  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? 0;

    if (status === 429) {
      console.warn(`[${tag}] Rate limited`);
      return failure(TranslationError.rateLimited());
    }

    if (status === 401 || status === 403) {
      console.warn(`[${tag}] Authentication failed (${status})`);
      return failure(
        TranslationError.failed(
          new Error('Invalid API key — check your credentials'),
        ),
      );
    }

    if (isVisionRejection(error.message)) {
      console.warn(
        `[${tag}] Model rejected image input (${status || 'no status'}):`,
        error.message,
      );
      return failure(TranslationError.modelNoVision(error.message));
    }

    if (status === 404) {
      console.warn(`[${tag}] Model not found: ${error.url}`);
      return failure(
        TranslationError.failed(
          new Error('Model not found — check your model selection'),
        ),
      );
    }

    if (status >= 500) {
      console.error(`[${tag}] Provider server error (${status})`);
      return failure(NetworkError.serverError(status, error.url));
    }

    console.error(`[${tag}] API call failed:`, error);
    return failure(TranslationError.failed(error));
  }

  if (error instanceof Error && error.name === 'AbortError') {
    console.warn(`[${tag}] Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    return failure(NetworkError.timeout());
  }

  console.error(`[${tag}] Translation error:`, error);
  return failure(AppError.fromUnknown(error));
}

export async function executeTranslation(
  model: LanguageModel,
  image: EncodedImage,
  targetLanguage: Language,
  tag: string,
  includeDescription = true,
  exemptions?: IStructuredOutputExemptionStorage,
): Promise<Result<Translation, AppError>> {
  const prompt = buildBasePrompt({
    targetLanguageCode: targetLanguage.code,
    targetLanguageName: targetLanguage.name,
    includeDescription,
  });

  const messages = [
    {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: prompt },
        {
          type: 'file' as const,
          data: { type: 'data' as const, data: image.base64Data },
          mediaType: image.mimeType,
        },
      ],
    },
  ];

  const modelKey = modelCacheKey(model);

  async function translateViaPlainGeneration(): Promise<
    Result<Translation, AppError>
  > {
    try {
      const { text } = await generateText({
        model,
        messages,
        temperature: 0,
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return interpretParsedTranslation(
        parseTranslationResponse(text),
        targetLanguage,
        tag,
      );
    } catch (error: unknown) {
      return mapGenerationError(error, tag);
    }
  }

  if (exemptions && modelKey) {
    const exemptResult = await exemptions.isExempt(modelKey);
    if (exemptResult.success && exemptResult.data) {
      console.info(
        `[${tag}] ${modelKey} is exempt from structured output — using prompt-only JSON mode`,
      );
      return translateViaPlainGeneration();
    }
    if (!exemptResult.success) {
      console.warn(
        `[${tag}] Could not read structured-output exemptions:`,
        exemptResult.error,
      );
    }
  }

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: translationDataSchema }),
      messages,
      temperature: 0,
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!output.success || !output.data) {
      console.error(`[${tag}] AI rejected translation:`, output.error);
      return failure(
        TranslationError.aiRejected(output.error ?? 'Unknown error'),
      );
    }

    return mapResponseToDomain(output.data, targetLanguage, tag);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return failure(error);
    }

    if (
      APICallError.isInstance(error) &&
      isResponseFormatUnsupported(error.message)
    ) {
      console.warn(
        `[${tag}] Model does not support the json_schema response format — retrying without it`,
      );
      if (exemptions && modelKey) {
        const markResult = await exemptions.exemptModel(modelKey);
        if (!markResult.success) {
          console.warn(
            `[${tag}] Could not persist structured-output exemption:`,
            markResult.error,
          );
        }
      }
      return translateViaPlainGeneration();
    }

    if (NoObjectGeneratedError.isInstance(error)) {
      console.warn(`[${tag}] Recovering response via manual JSON parsing`);
      return interpretParsedTranslation(
        parseTranslationResponse(error.text ?? ''),
        targetLanguage,
        tag,
      );
    }

    return mapGenerationError(error, tag);
  }
}
