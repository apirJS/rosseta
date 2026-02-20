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
  GroqTranslationResponseSchema,
  type GroqTranslationResponse,
} from './schema';
import { buildGroqTranslationPrompt } from './prompt';
import { v4 as uuidv4 } from 'uuid';

export class GroqTranslationAdapter implements ITranslationService {
  constructor(
    private readonly credential: Credential,
    private readonly userPreferences: UserPreferences,
  ) {}

  public async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
  ): Promise<Result<Translation, AppError>> {
    try {
      const prompt = buildGroqTranslationPrompt(targetLanguage.name);
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
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.credential.apiKey.value}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (response.status === 429) {
        console.warn('[GROQ] Rate limited');
        return failure(TranslationError.rateLimited());
      }

      if (!response.ok) {
        console.error('[GROQ] Request failed with status:', response.status);
        return failure(TranslationError.failed());
      }

      const responseData = await response.json();

      const rawText = responseData?.choices?.[0]?.message?.content;

      if (!rawText) {
        console.error('[GROQ] No text in response');
        return failure(TranslationError.failed());
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (error) {
        console.error('[GROQ] JSON parse error:', error);
        return failure(TranslationError.malformedResponse());
      }

      const validationResult =
        GroqTranslationResponseSchema.safeParse(parsedJson);
      if (!validationResult.success) {
        console.error(
          '[GROQ] Schema validation failed:',
          validationResult.error,
        );
        return failure(TranslationError.malformedResponse());
      }

      const translationResponse = validationResult.data;

      if (!translationResponse.success || !translationResponse.data) {
        console.error(
          '[GROQ] AI rejected translation:',
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
    data: NonNullable<GroqTranslationResponse['data']>,
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
      const lang = langResult.success
        ? langResult.data
        : Language.create('unknown');

      const segmentResult = TextSegment.create(
        item.text,
        lang,
        item.romanization,
      );
      if (!segmentResult.success) {
        return failure(TranslationError.malformedResponse());
      }

      originalSegments.push(segmentResult.data);
    }

    for (const item of data.translatedText.contents) {
      const segmentResult = TextSegment.create(
        item.text,
        targetLanguage,
        item.romanization,
      );
      if (!segmentResult.success) {
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
