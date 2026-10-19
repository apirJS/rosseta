import { v4 as uuidv4 } from 'uuid';
import { Language } from '../../../core/domain/translation/Language';
import { TextSegment } from '../../../core/domain/translation/TextSegment';
import { Translation } from '../../../core/domain/translation/Translation';
import { success, failure, type Result } from '../../../shared/types/Result';
import { TranslationError, type AppError } from '../../../shared/errors';

interface ResponseSegment {
  text: string;
  languageBcp47Code: string;
  language: string;
  romanization: string | null;
  blockIndex: number;
}

export interface TranslationData {
  originalText: { contents: ResponseSegment[] };
  translatedText: { contents: ResponseSegment[] };
  description?: string | null;
}

function resolveSourceLanguage(code: string, tag: string): Language {
  let language = Language.fromRaw(code);
  if (!language.success) language = Language.fromRaw(code.split('-')[0]);
  if (language.success) return language.data;

  console.warn(`[${tag}] Language.fromRaw failed for code:`, code, '— falling back to "unknown"');
  return Language.create('unknown');
}

function mapSegments(
  items: ResponseSegment[],
  languageFor: (item: ResponseSegment) => Language,
  tag: string,
): Result<TextSegment[], AppError> {
  const segments: TextSegment[] = [];
  for (const item of items) {
    const segment = TextSegment.create(item.text, languageFor(item), item.romanization, item.blockIndex);
    if (!segment.success) {
      console.error(`[${tag}] TextSegment.create failed:`, segment.error);
      return failure(TranslationError.malformedResponse());
    }
    segments.push(segment.data);
  }
  return success(segments);
}

export function mapResponseToDomain(data: TranslationData, targetLanguage: Language, tag: string): Result<Translation, AppError> {
  if (data.originalText.contents.length !== data.translatedText.contents.length) {
    console.error(`[${tag}] Segment count mismatch — original: ${data.originalText.contents.length}, translated: ${data.translatedText.contents.length}`);
    return failure(TranslationError.malformedResponse());
  }

  const original = mapSegments(data.originalText.contents, item => resolveSourceLanguage(item.languageBcp47Code, tag), tag);
  if (!original.success) return original;

  const translated = mapSegments(data.translatedText.contents, () => targetLanguage, tag);
  if (!translated.success) return translated;

  return success(Translation.create(uuidv4(), original.data, translated.data, data.description ?? '', new Date()));
}
