import type {
  TranslationDraft,
  TranslationDraftSegment,
} from '../../../../core/ports/outbound/TranslationExecutionOptions';
import { TranslationError } from '../../../../shared/errors';
import { MAX_TRANSLATION_SEGMENTS } from '../output/translation-response-limits';

export function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function blockIndex(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function mapDraftSegment(
  index: number,
  paired: unknown,
  source: unknown,
  target: unknown,
): TranslationDraftSegment {
  const pair = record(paired);
  const original = record(source);
  const translated = record(target);

  return {
    index,
    blockIndex: blockIndex(
      pair?.blockIndex ?? original?.blockIndex ?? translated?.blockIndex,
    ),
    originalText: text(pair?.originalText ?? original?.text),
    translatedText: text(pair?.translatedText ?? translated?.text),
    sourceLanguageCode: nullableText(
      pair?.originalLanguageBcp47Code ?? original?.languageBcp47Code,
    ),
    romanization: nullableText(pair?.romanization ?? original?.romanization),
  };
}

/** Keep unfinished or malformed rows in place so opposite sides stay aligned. */
export function mapTranslationDraft(value: unknown): TranslationDraft | null {
  const root = record(value);

  if (!root) return null;
  if (root.success === false) return { segments: [], description: null };

  const data = record(root.data);

  if (!data) return null;

  const paired = data.segments;
  const source = record(data.originalText)?.contents;
  const target = record(data.translatedText)?.contents;

  if (
    !Array.isArray(paired) &&
    !Array.isArray(source) &&
    !Array.isArray(target)
  )
    return null;

  const originals = Array.isArray(source) ? source : [];
  const translations = Array.isArray(target) ? target : [];

  const count = Array.isArray(paired)
    ? paired.length
    : Math.max(originals.length, translations.length);

  if (count > MAX_TRANSLATION_SEGMENTS) throw TranslationError.responseLimit();

  const segments = Array.from({ length: count }, (_, index) =>
    mapDraftSegment(
      index,
      Array.isArray(paired) ? paired[index] : null,
      originals[index],
      translations[index],
    ),
  );

  return { segments, description: nullableText(data.description) };
}
