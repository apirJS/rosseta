import {
  generateText,
  Output,
  APICallError,
  NoOutputGeneratedError,
  type LanguageModel,
} from 'ai';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import { failure, type Result } from '../../../shared/types/Result';
import {
  AppError,
  NetworkError,
  TranslationError,
} from '../../../shared/errors';
import { mapResponseToDomain } from './translation-response-mapper';
import { buildBasePrompt } from './prompt-base';
import { translationDataSchema } from './translation-schema';

const REQUEST_TIMEOUT_MS = 30_000;

const VISION_REJECTION_PATTERNS: RegExp[] = [
  /content must be a string/i,
  /does not support images?/i,
  /images? (?:are |is )?not supported/i,
  /not (?:a )?(?:multimodal|vision)/i,
  /(?:multimodal|vision) (?:support|capabilit)/i,
  /image (?:input|content) (?:is )?not (?:supported|allowed)/i,
];

function isVisionRejection(message: string): boolean {
  return VISION_REJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

export async function executeTranslation(
  model: LanguageModel,
  image: EncodedImage,
  targetLanguage: Language,
  tag: string,
): Promise<Result<Translation, AppError>> {
  try {
    const prompt = buildBasePrompt({
      targetLanguageCode: targetLanguage.code,
      targetLanguageName: targetLanguage.name,
    });

    const { output } = await generateText({
      model,
      output: Output.object({ schema: translationDataSchema }),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'file',
              data: { type: 'data', data: image.base64Data },
              mediaType: image.mimeType,
            },
          ],
        },
      ],
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

    if (error instanceof NoOutputGeneratedError) {
      console.error(`[${tag}] Response failed schema validation:`, error.cause);
      return failure(TranslationError.malformedResponse());
    }

    if (error instanceof APICallError) {
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

      if (
        (status === 400 || status === 422) &&
        isVisionRejection(error.message)
      ) {
        console.warn(
          `[${tag}] Model rejected image input (${status}):`,
          error.message,
        );
        return failure(TranslationError.modelNoVision(error.message));
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
}
