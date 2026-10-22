import { Language } from '../../../../core/domain/translation/Language';
import { failure, success, type Result } from '../../../../shared/types/Result';
import { TranslationError, type AppError } from '../../../../shared/errors';
import {
  MAX_TRANSLATION_BYTES,
  MAX_TRANSLATION_SEGMENTS,
} from './translation-response-limits';
import {
  pairedResponseSchema,
  legacyResponseSchema,
  type PairedResponse,
  type NormalizedTranslationResponse,
  type NormalizedTranslationData,
} from './translation-schema';

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sourceLanguageName(code: string): string {
  const language = Language.fromRaw(code);

  return language.success ? language.data.name : 'Unknown';
}

function exceedsResponseLimits(raw: unknown): boolean {
  const bytes = new TextEncoder().encode(JSON.stringify(raw) ?? '').byteLength;

  if (bytes > MAX_TRANSLATION_BYTES) return true;

  const data = record(record(raw)?.data);
  const originals = record(data?.originalText);
  const translations = record(data?.translatedText);

  return [data?.segments, originals?.contents, translations?.contents].some(
    (items) => Array.isArray(items) && items.length > MAX_TRANSLATION_SEGMENTS,
  );
}

function normalizePairedEnvelope(
  envelope: PairedResponse,
): Result<NormalizedTranslationResponse, AppError> {
  if (!envelope.success && envelope.data !== null)
    return failure(TranslationError.malformedResponse());

  if (!envelope.success || !envelope.data) {
    return success({
      success: envelope.success,
      error: envelope.error ?? null,
      data: null,
    });
  }

  const { segments, description } = envelope.data;

  return success({
    success: true,
    error: envelope.error ?? null,
    data: {
      originalText: {
        contents: segments.map((segment) => ({
          text: segment.originalText,
          blockIndex: segment.blockIndex,
          languageBcp47Code: segment.originalLanguageBcp47Code,
          language: sourceLanguageName(segment.originalLanguageBcp47Code),
          romanization: segment.romanization,
        })),
      },
      translatedText: {
        contents: segments.map((segment) => ({
          text: segment.translatedText,
          blockIndex: segment.blockIndex,
          languageBcp47Code: 'unknown',
          language: 'Unknown',
          romanization: null,
        })),
      },
      description,
    },
  });
}

/** Repair a known layout variation without inventing or discarding content. */
function normalizeDescriptionPlacement(raw: unknown): unknown {
  const envelope = record(raw);
  const data = record(envelope?.data);

  if (!envelope || !data || !Object.hasOwn(envelope, 'description')) return raw;

  const { description, ...rest } = envelope;

  if (Object.hasOwn(data, 'description') && data.description !== description)
    return raw;

  return { ...rest, data: { ...data, description } };
}

function omitDescriptions(raw: unknown): unknown {
  const envelope = record(raw);

  if (!envelope) return raw;

  const { description: _rootDescription, ...rest } = envelope;
  const data = record(envelope.data);

  if (!data) return rest;

  const { description: _dataDescription, ...translationData } = data;

  return { ...rest, data: translationData };
}

function parseResponseEnvelope(
  raw: unknown,
): Result<NormalizedTranslationResponse, AppError> {
  const envelope = normalizeDescriptionPlacement(raw);
  const paired = pairedResponseSchema.safeParse(envelope);

  if (paired.success) return normalizePairedEnvelope(paired.data);

  const legacy = legacyResponseSchema.safeParse(envelope);

  if (!legacy.success) return failure(TranslationError.malformedResponse());

  return success({
    success: legacy.data.success,
    error: legacy.data.error ?? null,
    data: legacy.data.data ?? null,
  });
}

function hasValidSegmentPairs(data: NormalizedTranslationData): boolean {
  const originals = data.originalText.contents;
  const translations = data.translatedText.contents;

  if (!originals.length || originals.length > MAX_TRANSLATION_SEGMENTS)
    return false;
  if (originals.length !== translations.length) return false;

  let previousBlock = 0;

  for (const [index, original] of originals.entries()) {
    const translated = translations[index];

    if (!original.text.trim() || !translated.text.trim()) return false;
    if (original.blockIndex !== translated.blockIndex) return false;
    if (index === 0 && original.blockIndex !== 0) return false;
    if (
      original.blockIndex < previousBlock ||
      original.blockIndex > previousBlock + 1
    )
      return false;
    previousBlock = original.blockIndex;
  }

  return true;
}

/** Both generated formats enter the same complete-validation gate before history. */
export function normalizeTranslationResponse(
  raw: unknown,
  includeDescription?: boolean,
): Result<NormalizedTranslationResponse, AppError> {
  try {
    if (exceedsResponseLimits(raw))
      return failure(TranslationError.responseLimit());
  } catch {
    // SDK output is unknown at this boundary. An unserializable object is an
    // invalid representation; callers can still inspect the completed text.
    return failure(TranslationError.malformedResponse());
  }

  const parsed = parseResponseEnvelope(
    includeDescription === false ? omitDescriptions(raw) : raw,
  );

  if (!parsed.success) return parsed;

  const response = parsed.data;

  if (!response.success) {
    return response.error?.trim() && response.data === null
      ? success(response)
      : failure(TranslationError.malformedResponse());
  }

  if (!response.data || response.error !== null)
    return failure(TranslationError.malformedResponse());
  if (!hasValidSegmentPairs(response.data))
    return failure(TranslationError.malformedResponse());

  if (
    includeDescription === true &&
    typeof response.data.description !== 'string'
  ) {
    return failure(TranslationError.malformedResponse());
  }

  if (includeDescription === false) {
    const { description: _description, ...data } = response.data;

    return success({ ...response, data });
  }

  return success(response);
}
