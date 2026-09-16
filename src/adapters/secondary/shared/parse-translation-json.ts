import {
  translationDataLenientSchema,
  type TranslationResponse,
} from './translation-schema';
import { success, failure, type Result } from '../../../shared/types/Result';
import { TranslationError, type AppError } from '../../../shared/errors';

export function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

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

export function parseTranslationResponse(
  text: string,
): Result<TranslationResponse, AppError> {
  const candidate = extractJsonObject(text.trim());
  if (candidate === null) {
    return failure(TranslationError.malformedResponse());
  }

  let raw: unknown;
  try {
    raw = JSON.parse(candidate);
  } catch {
    return failure(TranslationError.malformedResponse());
  }

  const parsed = translationDataLenientSchema.safeParse(raw);
  if (!parsed.success) {
    return failure(TranslationError.malformedResponse());
  }

  return success({
    success: parsed.data.success,
    error: parsed.data.error ?? null,
    data: parsed.data.data ?? null,
  });
}
