import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import { Language } from '../../../core/domain/translation/Language';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import { Translation } from '../../../core/domain/translation/Translation';
import { TextSegment } from '../../../core/domain/translation/TextSegment';
import { success, failure, type Result } from '../../../shared/types/Result';
import { AppError, TranslationError } from '../../../shared/errors';
import type { Credential } from '../../../core/domain/credential/Credential';
import type { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import {
  TranslationResponseSchema,
  TranslationResponseBaseSchema,
} from './schema';
import { buildTranslationPrompt } from './prompt';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const GEMINI_URL_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiTranslationAdapter implements ITranslationService {
  constructor(
    private readonly credential: Credential,
    private readonly userPreferences: UserPreferences,
  ) {}

  public async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
  ): Promise<Result<Translation, AppError>> {
    try {
      const url = this.buildRequestUrl();

      const headers = this.buildRequestHeaders();
      const body = this.buildRequestBody(image, targetLanguage);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (response.status === 429) {
        console.warn('[GEMINI] Rate limited');
        return failure(TranslationError.rateLimited());
      }

      if (!response.ok) {
        console.error('[GEMINI] Request failed with status:', response.status);
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

      const rawText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        console.error('[GEMINI] No text in response');
        return failure(TranslationError.failed());
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (error) {
        console.error('[GEMINI] JSON parse error:', error);
        return failure(TranslationError.malformedResponse());
      }

      const validationResult = TranslationResponseSchema.safeParse(parsedJson);
      if (!validationResult.success) {
        console.error(
          '[GEMINI] Schema validation failed:',
          validationResult.error,
        );
        return failure(TranslationError.malformedResponse());
      }

      const translationResponse = validationResult.data;

      if (!translationResponse.success || !translationResponse.data) {
        console.error(
          '[GEMINI] AI rejected translation:',
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

  private buildRequestUrl(): string {
    const apiKey = this.credential.apiKey.value;
    const baseUrl = this.userPreferences.proxyUrl ?? GEMINI_URL_ENDPOINT;
    return `${baseUrl}/${this.userPreferences.selectedModel.id}:generateContent?key=${apiKey}`;
  }

  private buildRequestHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  }

  private buildRequestBody(
    image: EncodedImage,
    targetLanguage: Language,
  ): string {
    const prompt = buildTranslationPrompt(targetLanguage.name);
    const responseSchema = z.toJSONSchema(TranslationResponseBaseSchema, {
      target: 'openapi-3.0',
    });

    // Gemini API does not support "additionalProperties" in responseSchema.
    // Zod v4 emits it by default — strip it recursively.
    this.stripAdditionalProperties(responseSchema);

    return JSON.stringify({
      system_instruction: {
        parts: [{ text: prompt }],
      },
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: image.mimeType,
                data: image.base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.2,
      },
    });
  }

  /**
   * Recursively removes "additionalProperties" from a JSON schema object,
   * since Gemini's OpenAPI 3.0 spec does not support it.
   */
  private stripAdditionalProperties(obj: unknown): void {
    if (obj === null || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) this.stripAdditionalProperties(item);
      return;
    }

    const record = obj as Record<string, unknown>;
    delete record['additionalProperties'];

    for (const value of Object.values(record)) {
      this.stripAdditionalProperties(value);
    }
  }

  private mapToDomain(
    data: NonNullable<import('./schema').TranslationResponse['data']>,
    targetLanguage: Language,
  ): Result<Translation, AppError> {
    const originalSegments: TextSegment[] = [];
    const translatedSegments: TextSegment[] = [];

    for (const item of data.originalText.contents) {
      const bcp47Code = item.languageBcp47Code;

      let langResult = Language.fromRaw(bcp47Code);
      if (!langResult.success) {
        const shortCode = bcp47Code.split('-')[0];
        langResult = Language.fromRaw(shortCode);
      }
      if (!langResult.success) {
        console.warn(
          '[GEMINI] Language.fromRaw failed for code:',
          bcp47Code,
          '— falling back to "unknown"',
        );
      }
      const lang = langResult.success
        ? langResult.data
        : Language.create('unknown');

      const segmentResult = TextSegment.create(
        item.text,
        lang,
        item.romanization,
      );
      if (!segmentResult.success) {
        console.error(
          '[GEMINI] TextSegment.create failed:',
          segmentResult.error,
        );
        return failure(TranslationError.malformedResponse());
      }

      originalSegments.push(segmentResult.data);
    }

    for (const item of data.translatedText.contents) {
      // Note: For translated segments, we use the targetLanguage passed to this method
      // rather than parsing the BCP47 code from the response, since we already have
      // the correct Language domain object
      const segmentResult = TextSegment.create(
        item.text,
        targetLanguage,
        item.romanization,
      );
      if (!segmentResult.success) {
        console.error(
          '[GEMINI] TextSegment.create (translated) failed:',
          segmentResult.error,
        );
        return failure(TranslationError.malformedResponse());
      }

      translatedSegments.push(segmentResult.data);
    }

    const translation = new Translation(
      uuidv4(),
      originalSegments,
      translatedSegments,
      data.description,
      new Date(),
    );

    return success(translation);
  }
}
