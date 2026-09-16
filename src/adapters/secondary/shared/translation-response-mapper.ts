import { v4 as uuidv4 } from 'uuid';
import { Language } from '../../../core/domain/translation/Language';
import { TextSegment } from '../../../core/domain/translation/TextSegment';
import { Translation } from '../../../core/domain/translation/Translation';
import { success, failure, type Result } from '../../../shared/types/Result';
import { TranslationError, type AppError } from '../../../shared/errors';

export interface TranslationData {
  originalText: {
    contents: {
      text: string;
      languageBcp47Code: string;
      language: string;
      romanization: string | null;
      blockIndex: number;
    }[];
  };
  translatedText: {
    contents: {
      text: string;
      languageBcp47Code: string;
      language: string;
      romanization: string | null;
      blockIndex: number;
    }[];
  };
  description?: string | null;
}

export function mapResponseToDomain(
  data: TranslationData,
  targetLanguage: Language,
  tag: string,
): Result<Translation, AppError> {
  const originalSegments: TextSegment[] = [];
  const translatedSegments: TextSegment[] = [];

  if (data.originalText.contents.length !== data.translatedText.contents.length) {
    console.error(
      `[${tag}] Segment count mismatch — original: ${data.originalText.contents.length}, translated: ${data.translatedText.contents.length}`,
    );
    return failure(TranslationError.malformedResponse());
  }

  for (const item of data.originalText.contents) {
    const bcp47Code = item.languageBcp47Code;

    let langResult = Language.fromRaw(bcp47Code);
    if (!langResult.success) {
      const shortCode = bcp47Code.split('-')[0];
      langResult = Language.fromRaw(shortCode);
    }
    if (!langResult.success) {
      console.warn(
        `[${tag}] Language.fromRaw failed for code:`,
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
      item.blockIndex,
    );
    if (!segmentResult.success) {
      console.error(`[${tag}] TextSegment.create failed:`, segmentResult.error);
      return failure(TranslationError.malformedResponse());
    }

    originalSegments.push(segmentResult.data);
  }

  for (const item of data.translatedText.contents) {
    const segmentResult = TextSegment.create(
      item.text,
      targetLanguage,
      item.romanization,
      item.blockIndex,
    );
    if (!segmentResult.success) {
      console.error(
        `[${tag}] TextSegment.create (translated) failed:`,
        segmentResult.error,
      );
      return failure(TranslationError.malformedResponse());
    }

    translatedSegments.push(segmentResult.data);
  }

  const translation = Translation.create(
    uuidv4(),
    originalSegments,
    translatedSegments,
    data.description ?? '',
    new Date(),
  );

  return success(translation);
}
