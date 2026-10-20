import type { TranslationResponse } from "./translation-schema";
import { normalizeTranslationResponse } from "./translation-response-normalizer";
import { success, failure, type Result } from "../../../shared/types/Result";
import {
  ErrorCode,
  TranslationError,
  type AppError,
} from "../../../shared/errors";
import { MAX_TRANSLATION_BYTES } from "./translation-response-limits";

const MAX_OBJECT_OPENINGS = 8192;
const MAX_CANDIDATE_CHARACTERS = 8 * MAX_TRANSLATION_BYTES;

/**
 * Returns every balanced JSON object candidate in the response.
 *
 * LLMs sometimes put an example object, a tool trace, or explanatory prose
 * before the actual response. A single string-aware pass also finds balanced
 * children of incomplete wrappers without repeatedly rescanning their contents.
 */
export function extractJsonObjects(text: string): string[] {
  const openings: number[] = [];
  const ranges: { start: number; end: number }[] = [];
  let inString = false;
  let escaped = false;
  let openingCount = 0;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inString && char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      if (++openingCount > MAX_OBJECT_OPENINGS) return [];
      openings.push(index);
    } else if (char === "}" && openings.length) {
      ranges.push({ start: openings.pop()!, end: index + 1 });
    }
  }

  const candidates: string[] = [];
  let budget = MAX_CANDIDATE_CHARACTERS;

  for (const range of ranges.toSorted((a, b) => a.start - b.start)) {
    const length = range.end - range.start;
    if (length > budget) break;
    budget -= length;
    candidates.push(text.slice(range.start, range.end));
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
