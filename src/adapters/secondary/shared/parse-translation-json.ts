import {
  translationDataLenientSchema,
  type TranslationResponse,
} from './translation-schema';
import { success, failure, type Result } from '../../../shared/types/Result';
import { TranslationError, type AppError } from '../../../shared/errors';

function extractBalancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString && char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * Returns every balanced JSON object candidate in the response.
 *
 * LLMs sometimes put an example object, a tool trace, or explanatory prose
 * before the actual response. Starting at every opening brace lets the parser
 * skip those candidates and continue looking for the first object that matches
 * our response schema.
 */
export function extractJsonObjects(text: string): string[] {
  const candidates: string[] = [];
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue;
    const candidate = extractBalancedObject(text, start);
    if (candidate !== null) candidates.push(candidate);
  }
  return candidates;
}

export function extractJsonObject(text: string): string | null {
  return extractJsonObjects(text)[0] ?? null;
}

export function parseTranslationResponse(
  text: string,
): Result<TranslationResponse, AppError> {
  for (const candidate of extractJsonObjects(text)) {
    let raw: unknown;
    try {
      raw = JSON.parse(candidate);
    } catch {
      continue;
    }

    const parsed = translationDataLenientSchema.safeParse(raw);
    if (!parsed.success) continue;

    return success({
      success: parsed.data.success,
      error: parsed.data.error ?? null,
      data: parsed.data.data ?? null,
    });
  }

  return failure(TranslationError.malformedResponse());
}
