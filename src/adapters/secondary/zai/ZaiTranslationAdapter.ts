import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import { Language } from '../../../core/domain/translation/Language';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import { failure, type Result } from '../../../shared/types/Result';
import { AppError, TranslationError } from '../../../shared/errors';
import type { Credential } from '../../../core/domain/credential/Credential';
import type { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import {
  ZaiTranslationResponseSchema,
  type ZaiTranslationResponse,
} from './schema';
import { buildZaiTranslationPrompt } from './prompt';
import { mapResponseToDomain } from '../shared/translation-response-mapper';

const ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4';

const RESPONSE_JSON_SCHEMA = {
  name: 'translation_response',
  schema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      error: { type: ['string', 'null'] },
      data: {
        type: ['object', 'null'],
        properties: {
          originalText: {
            type: 'object',
            properties: {
              contents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    languageBcp47Code: { type: 'string' },
                    language: { type: 'string' },
                    romanization: { type: ['string', 'null'] },
                  },
                  required: [
                    'text',
                    'languageBcp47Code',
                    'language',
                    'romanization',
                  ],
                },
              },
            },
            required: ['contents'],
          },
          translatedText: {
            type: 'object',
            properties: {
              contents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    languageBcp47Code: { type: 'string' },
                    language: { type: 'string' },
                    romanization: { type: ['string', 'null'] },
                  },
                  required: [
                    'text',
                    'languageBcp47Code',
                    'language',
                    'romanization',
                  ],
                },
              },
            },
            required: ['contents'],
          },
          description: { type: 'string' },
        },
        required: ['originalText', 'translatedText', 'description'],
      },
    },
    required: ['success', 'error', 'data'],
  },
} as const;

export class ZaiTranslationAdapter implements ITranslationService {
  constructor(
    private readonly credential: Credential,
    private readonly userPreferences: UserPreferences,
  ) {}

  public async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
  ): Promise<Result<Translation, AppError>> {
    try {
      const prompt = buildZaiTranslationPrompt({
        targetLanguageCode: targetLanguage.code,
        targetLanguageName: targetLanguage.name,
      });
      const imageUrl = `data:${image.mimeType};base64,${image.base64Data}`;

      const body = JSON.stringify({
        model: this.userPreferences.selectedModel.id,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: RESPONSE_JSON_SCHEMA,
        },
        thinking: { type: 'disabled' },
      });

      const baseUrl = this.userPreferences.proxyUrl ?? ZAI_BASE_URL;
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.credential.apiKey.value}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(30_000),
      });

      if (response.status === 429) {
        console.warn('[ZAI] Rate limited');
        return failure(TranslationError.rateLimited());
      }

      if (!response.ok) {
        console.error('[ZAI] Request failed with status:', response.status);
        const hint =
          response.status === 404
            ? 'check your proxy URL'
            : response.status === 401
              ? 'invalid API key'
              : response.status === 403
                ? 'access denied'
                : response.status >= 500
                  ? 'server error, try again later'
                  : `HTTP ${response.status}`;
        return failure(
          TranslationError.failed(
            new Error(`Request failed (${response.status}) — ${hint}`),
          ),
        );
      }

      const responseData = await response.json();
      const rawText = responseData?.choices?.[0]?.message?.content;

      if (!rawText) {
        console.error('[ZAI] No text in response');
        return failure(TranslationError.failed());
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (error) {
        console.error('[ZAI] JSON parse error:', error);
        return failure(TranslationError.malformedResponse());
      }

      const validationResult =
        ZaiTranslationResponseSchema.safeParse(parsedJson);
      if (!validationResult.success) {
        console.error(
          '[ZAI] Schema validation failed:',
          validationResult.error,
        );
        return failure(TranslationError.malformedResponse());
      }

      const translationResponse = validationResult.data;

      if (!translationResponse.success || !translationResponse.data) {
        console.error(
          '[ZAI] AI rejected translation:',
          translationResponse.error,
        );
        return failure(
          TranslationError.aiRejected(
            translationResponse.error ?? 'Unknown error',
          ),
        );
      }

      return this.mapToDomain(translationResponse.data, targetLanguage);
    } catch (error) {
      if (error instanceof AppError) {
        return failure(error);
      }
      return failure(AppError.fromUnknown(error));
    }
  }

  private mapToDomain(
    data: NonNullable<ZaiTranslationResponse['data']>,
    targetLanguage: Language,
  ): Result<Translation, AppError> {
    return mapResponseToDomain(data, targetLanguage, 'ZAI');
  }
}
