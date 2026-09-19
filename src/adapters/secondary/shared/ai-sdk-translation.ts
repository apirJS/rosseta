import {
  generateText,
  Output,
  APICallError,
  NoOutputGeneratedError,
  NoObjectGeneratedError,
  RetryError,
  type LanguageModel,
} from 'ai';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import type { IStructuredOutputExemptionStorage } from '../../../core/ports/outbound/IStructuredOutputExemptionStorage';
import type { ICancellationToken } from '../../../core/ports/outbound/ICancellationToken';
import { failure, type Result } from '../../../shared/types/Result';
import {
  AppError,
  AuthError,
  NetworkError,
  TranslationError,
} from '../../../shared/errors';
import { mapResponseToDomain } from './translation-response-mapper';
import { buildBasePrompt, buildPlainPrompt } from './prompt-base';
import {
  createTranslationDataSchema,
  type TranslationResponse,
} from './translation-schema';
import { parseTranslationResponse } from './parse-translation-json';

const REQUEST_TIMEOUT_MS = 60_000;

function createRequestAbortSignal(
  cancellationToken?: ICancellationToken,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!cancellationToken) return timeoutSignal;
  if (cancellationToken.isCancellationRequested) return AbortSignal.abort();

  const controller = new AbortController();
  const unsubscribe = cancellationToken.onCancellationRequested(() => {
    controller.abort();
  });
  const signal = AbortSignal.any([controller.signal, timeoutSignal]);
  signal.addEventListener('abort', unsubscribe, { once: true });
  return signal;
}

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

const CONTENT_BLOCKED_PATTERNS: RegExp[] = [
  /content.{0,30}(?:blocked|filter|moderation|policy)/i,
  /(?:safety|moderation) policy/i,
  /(?:unsafe|prohibited) content/i,
];
const CONTEXT_LIMIT_PATTERNS: RegExp[] = [
  /context (?:length|window)/i,
  /maximum context/i,
  /too many tokens/i,
  /token limit/i,
  /input is too long/i,
];
const IMAGE_TOO_LARGE_PATTERNS: RegExp[] = [
  /image.{0,30}too large/i,
  /image.{0,30}(?:size|dimensions).{0,30}(?:exceed|limit)/i,
  /payload too large/i,
  /request entity too large/i,
];
const QUOTA_PATTERNS: RegExp[] = [
  /insufficient.{0,20}(?:quota|credit|balance)/i,
  /(?:quota|credit|balance).{0,30}(?:exceed|exhaust|deplet|insufficient)/i,
  /billing/i,
];

function isVisionRejection(message: string): boolean {
  return VISION_REJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

function isResponseFormatUnsupported(message: string): boolean {
  return RESPONSE_FORMAT_UNSUPPORTED_PATTERNS.some((pattern) =>
    pattern.test(message),
  );
}

function matchesAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

function apiErrorDetail(error: APICallError): string {
  let data = '';
  if (typeof error.data === 'string') {
    data = error.data;
  } else if (error.data !== undefined) {
    try {
      data = JSON.stringify(error.data);
    } catch {
      data = '';
    }
  }
  return [error.message, error.responseBody, data].filter(Boolean).join(' ');
}

function unwrapRetryError(error: unknown): unknown {
  let current = error;
  for (let depth = 0; depth < 5 && RetryError.isInstance(current); depth++) {
    current = current.lastError;
  }
  return current;
}

function modelCacheKey(model: LanguageModel): string | null {
  if (typeof model !== 'object' || model === null) return null;
  if (!('provider' in model) || !('modelId' in model)) return null;
  return `${model.provider}:${model.modelId}`;
}

function interpretParsedTranslation(
  parsed: Result<TranslationResponse, AppError>,
  targetLanguage: Language,
  tag: string,
): Result<Translation, AppError> {
  if (!parsed.success) {
    return failure(TranslationError.malformedResponse());
  }

  if (!parsed.data.success || !parsed.data.data) {
    const reason = parsed.data.error ?? 'Unknown error';
    console.error(
      `[${tag}] AI rejected translation:`,
      reason,
    );
    return failure(TranslationError.aiRejected(reason));
  }

  return mapResponseToDomain(parsed.data.data, targetLanguage, tag);
}

function mapGenerationError(
  error: unknown,
  tag: string,
  cancellationToken?: ICancellationToken,
): Result<Translation, AppError> {
  if (cancellationToken?.isCancellationRequested) {
    return failure(TranslationError.failed(new Error('Translation cancelled')));
  }

  if (error instanceof AppError) {
    return failure(error);
  }

  error = unwrapRetryError(error);

  if (error instanceof AppError) {
    return failure(error);
  }

  if (NoOutputGeneratedError.isInstance(error)) {
    console.error(`[${tag}] Response failed schema validation:`, error.cause);
    return failure(TranslationError.malformedResponse());
  }

  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? 0;
    const detail = apiErrorDetail(error);

    if (matchesAny(detail, CONTENT_BLOCKED_PATTERNS)) {
      return failure(TranslationError.contentBlocked());
    }
    if (matchesAny(detail, CONTEXT_LIMIT_PATTERNS)) {
      return failure(TranslationError.contextLimit());
    }
    if (status === 413 || matchesAny(detail, IMAGE_TOO_LARGE_PATTERNS)) {
      return failure(TranslationError.imageTooLarge());
    }

    if (status === 429) {
      console.warn(`[${tag}] Rate limited`);
      if (matchesAny(detail, QUOTA_PATTERNS)) {
        return failure(TranslationError.quotaExceeded());
      }
      return failure(TranslationError.rateLimited());
    }

    if (status === 401) {
      console.warn(`[${tag}] Authentication failed (${status})`);
      return failure(AuthError.invalidApiKey());
    }

    if (status === 402) {
      return failure(AuthError.paymentRequired());
    }

    if (status === 403) {
      return failure(AuthError.accessDenied());
    }

    if (isVisionRejection(error.message)) {
      console.warn(
        `[${tag}] Model rejected image input (${status || 'no status'}):`,
        error.message,
      );
      return failure(TranslationError.modelNoVision(error.message));
    }

    if (status === 404) {
      return failure(TranslationError.modelNotFound());
    }

    if (status === 408 || status === 504) {
      return failure(NetworkError.timeout(error.url));
    }

    if (status === 400 || status === 409 || status === 422) {
      return failure(TranslationError.requestRejected(detail));
    }

    if (status >= 500) {
      console.error(`[${tag}] Provider server error (${status})`);
      return failure(NetworkError.providerUnavailable(status, error.url));
    }

    console.error(`[${tag}] API call failed:`, error);
    return failure(TranslationError.failed(error));
  }

  if (error instanceof Error && error.name === 'AbortError') {
    console.warn(`[${tag}] Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    return failure(NetworkError.timeout());
  }

  if (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|network error/i.test(error.message))
  ) {
    return failure(NetworkError.connectionFailed(undefined, error));
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
  cancellationToken?: ICancellationToken,
): Promise<Result<Translation, AppError>> {
  const prompt = buildBasePrompt({
    targetLanguageCode: targetLanguage.code,
    targetLanguageName: targetLanguage.name,
    includeDescription,
  });
  const plainPrompt = buildPlainPrompt({
    targetLanguageCode: targetLanguage.code,
    targetLanguageName: targetLanguage.name,
    includeDescription,
  });

  const filePart = {
    type: 'file' as const,
    data: { type: 'data' as const, data: image.base64Data },
    mediaType: image.mimeType,
  };

  const messages = [
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: 'Extract and translate all text in this image.',
        },
        filePart,
      ],
    },
  ];

  const modelKey = modelCacheKey(model);

  async function markExemptFromStructuredOutput(): Promise<void> {
    if (!exemptions || !modelKey) return;
    const markResult = await exemptions.exemptModel(modelKey);
    if (!markResult.success) {
      console.warn(
        `[${tag}] Could not persist structured-output exemption:`,
        markResult.error,
      );
    }
  }

  async function translateViaPlainGeneration(): Promise<
    Result<Translation, AppError>
  > {
    try {
      const { text } = await generateText({
        model,
        instructions: plainPrompt,
        messages,
        temperature: 0,
        abortSignal: createRequestAbortSignal(cancellationToken),
      });
      if (!text.trim()) {
        return failure(TranslationError.emptyResponse());
      }
      const parsed = parseTranslationResponse(text);
      if (parsed.success) {
        return interpretParsedTranslation(parsed, targetLanguage, tag);
      }
      console.warn(
        `[${tag}] Plain response unparseable — attempting repair retry`,
      );
      return await translateViaRepair(text);
    } catch (error: unknown) {
      return mapGenerationError(error, tag, cancellationToken);
    }
  }

  async function translateViaRepair(
    previousText: string,
  ): Promise<Result<Translation, AppError>> {
    const repairInstruction = `Your previous response could not be parsed as the required JSON. Respond with ONLY the JSON object described in the system instructions — no prose, no markdown fences, no extra keys. If the image contains no readable text, return {"success":false,"error":"NO_TEXT_FOUND"}.\n\nPrevious response:\n"""\n${previousText.slice(0, 4000)}\n"""`;
    try {
      const { text } = await generateText({
        model,
        instructions: plainPrompt,
        messages: [
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: repairInstruction },
              filePart,
            ],
          },
        ],
        temperature: 0,
        abortSignal: createRequestAbortSignal(cancellationToken),
      });
      if (!text.trim()) {
        return failure(TranslationError.emptyResponse());
      }
      return interpretParsedTranslation(
        parseTranslationResponse(text),
        targetLanguage,
        tag,
      );
    } catch (error: unknown) {
      return mapGenerationError(error, tag, cancellationToken);
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
      instructions: prompt,
      output: Output.object({
        schema: createTranslationDataSchema(includeDescription),
      }),
      messages,
      temperature: 0,
      abortSignal: createRequestAbortSignal(cancellationToken),
    });

    if (!output.success || !output.data) {
      console.error(`[${tag}] AI rejected translation:`, output.error);
      return failure(
        TranslationError.aiRejected(output.error ?? 'Unknown error'),
      );
    }

    return mapResponseToDomain(output.data, targetLanguage, tag);
  } catch (error: unknown) {
    const normalized = unwrapRetryError(error);

    if (normalized instanceof AppError) {
      return failure(normalized);
    }

    if (
      APICallError.isInstance(normalized) &&
      isResponseFormatUnsupported(apiErrorDetail(normalized))
    ) {
      console.warn(
        `[${tag}] Model does not support the json_schema response format — retrying without it`,
      );
      await markExemptFromStructuredOutput();
      return translateViaPlainGeneration();
    }

    if (NoObjectGeneratedError.isInstance(normalized)) {
      const parsed = parseTranslationResponse(normalized.text ?? '');
      if (parsed.success) {
        console.warn(`[${tag}] Recovering response via manual JSON parsing`);
        // The model emitted our exact JSON contract but the provider's
        // structured-output path still rejected it — skip that path next time.
        await markExemptFromStructuredOutput();
        return interpretParsedTranslation(parsed, targetLanguage, tag);
      }
      console.warn(`[${tag}] Response unparseable — attempting repair retry`);
      return translateViaRepair(normalized.text ?? '');
    }

    return mapGenerationError(normalized, tag, cancellationToken);
  }
}
