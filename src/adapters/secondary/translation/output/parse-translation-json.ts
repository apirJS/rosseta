import type { TranslationResponse } from './translation-schema';
import { normalizeTranslationResponse } from './translation-response-normalizer';
import { success, failure, type Result } from '../../../../shared/types/Result';
import {
  ErrorCode,
  TranslationError,
  type AppError,
} from '../../../../shared/errors';
import { MAX_TRANSLATION_BYTES } from '../preview/translation-response-limits';

const MAX_OBJECT_OPENINGS = 8192;

interface ObjectFrame {
  start: number;
  end?: number;
  parent?: ObjectFrame;
  fields: Map<string, string>;
  insideResponse: boolean;
  insideCompleteObject: boolean;
}

const RESPONSE_FIELDS = new Set([
  'success',
  'error',
  'data',
  'segments',
  'originalText',
  'translatedText',
]);

function responseField(
  text: string,
  start: number,
  end: number,
): { key: string; valueStart: string } | null {
  let next = end + 1;

  while (/\s/.test(text[next] ?? '') && next < text.length) next++;
  if (text[next] !== ':') return null;

  try {
    const key: unknown = JSON.parse(text.slice(start, end + 1));

    if (typeof key !== 'string' || !RESPONSE_FIELDS.has(key)) return null;

    next++;
    while (/\s/.test(text[next] ?? '') && next < text.length) next++;

    return { key, valueStart: text[next] ?? '' };
  } catch {
    return null;
  }
}

function isResponseEnvelope(frame: ObjectFrame): boolean {
  const fields = frame.fields;
  const booleanSuccess = ['t', 'f'].includes(fields.get('success') ?? '');

  return (
    (booleanSuccess && (fields.has('error') || fields.has('data'))) ||
    (fields.has('error') && fields.has('data')) ||
    fields.get('segments') === '[' ||
    (fields.get('originalText') === '{' && fields.get('translatedText') === '{')
  );
}

/**
 * Returns complete JSON object candidates in the response.
 *
 * LLMs sometimes put an example object, a tool trace, or explanatory prose
 * before the actual response. Translation envelopes inside non-response wrappers
 * can be recovered, but never from another complete or incomplete response.
 * Only outer objects and response envelopes are sliced, keeping scans bounded.
 */
export function extractJsonObjects(text: string): string[] {
  const openings: ObjectFrame[] = [];
  const frames: ObjectFrame[] = [];
  let inString = false;
  let escaped = false;
  let openingCount = 0;
  let stringStart = 0;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (escaped) {
      escaped = false;

      continue;
    }

    if (inString && char === '\\') {
      escaped = true;

      continue;
    }

    if (char === '"') {
      // Quotes in surrounding prose are not JSON string delimiters.
      if (!openings.length) continue;

      if (!inString) stringStart = index;
      else {
        const field = responseField(text, stringStart, index);

        if (field !== null)
          openings.at(-1)!.fields.set(field.key, field.valueStart);
      }

      inString = !inString;

      continue;
    }

    if (inString) continue;

    if (char === '{') {
      if (++openingCount > MAX_OBJECT_OPENINGS) return [];

      const frame: ObjectFrame = {
        start: index,
        parent: openings.at(-1),
        fields: new Map(),
        insideResponse: false,
        insideCompleteObject: false,
      };

      openings.push(frame);
      frames.push(frame);
    } else if (char === '}' && openings.length) {
      const frame = openings.pop()!;

      frame.end = index + 1;
    }
  }

  const candidates: string[] = [];

  // Parents precede children, so inherited state is resolved once per object,
  // including parents whose closing brace never arrived.
  for (const frame of frames) {
    if (frame.parent) {
      frame.insideResponse =
        frame.parent.insideResponse || isResponseEnvelope(frame.parent);

      frame.insideCompleteObject =
        frame.parent.insideCompleteObject || frame.parent.end !== undefined;
    }

    if (frame.end === undefined || frame.insideResponse) continue;
    if (!isResponseEnvelope(frame) && frame.insideCompleteObject) continue;

    candidates.push(text.slice(frame.start, frame.end));
  }

  return candidates;
}

export function extractJsonObject(text: string): string | null {
  return extractJsonObjects(text)[0] ?? null;
}

export function parseTranslationResponse(
  text: string,
  includeDescription?: boolean,
): Result<TranslationResponse, AppError> {
  if (new TextEncoder().encode(text).byteLength > MAX_TRANSLATION_BYTES)
    return failure(TranslationError.responseLimit());

  for (const candidate of extractJsonObjects(text)) {
    let raw: unknown;

    try {
      raw = JSON.parse(candidate);
    } catch {
      continue;
    }

    const parsed = normalizeTranslationResponse(raw, includeDescription);

    if (
      !parsed.success &&
      parsed.error.code === ErrorCode.TRANSLATION_RESPONSE_LIMIT
    )
      return failure(parsed.error);
    if (!parsed.success) continue;

    return success(parsed.data);
  }

  return failure(TranslationError.malformedResponse());
}
