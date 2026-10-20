/* eslint-disable no-await-in-loop -- Candidate parsing stays bounded and ordered. */
import { parsePartialJson } from "ai";
import { TranslationError } from "../../../shared/errors";
import type { TranslationDraft } from "../../../core/ports/outbound/TranslationExecutionOptions";
import { mapTranslationDraft, record } from "./translation-draft-mapper";
import { MAX_TRANSLATION_BYTES } from "./translation-response-limits";

export { MAX_TRANSLATION_BYTES } from "./translation-response-limits";
const MAX_PREVIEW_CANDIDATES = 32;

/** Locate top-level objects without treating braces inside strings as delimiters. */
function findCandidateObjects(text: string): string[] {
  const trimmed = text.trimStart().replace(/^```(?:json)?\s*/i, "");
  const candidates: string[] = [];
  let inString = false;
  let escaped = false;
  let depth = 0;
  let start = -1;

  for (let index = 0; index < trimmed.length; index++) {
    const char = trimmed[index];
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
      if (depth === 0) start = index;
      depth++;
    } else if (char === "}" && depth > 0) {
      depth--;
      if (depth === 0) {
        candidates.push(trimmed.slice(start, index + 1));
        start = -1;
      }
    }
  }
  if (start >= 0) candidates.push(trimmed.slice(start));
  return candidates;
}

async function parseCandidateDraft(
  candidate: string,
): Promise<TranslationDraft | null> {
  const parsed = await parsePartialJson(candidate);
  const root = record(parsed.value);

  if (!root || (!("success" in root) && !("data" in root))) return null;

  return mapTranslationDraft(root);
}

export async function parsePartialTranslationJson(
  text: string,
): Promise<TranslationDraft | null> {
  if (new TextEncoder().encode(text).byteLength > MAX_TRANSLATION_BYTES) {
    throw TranslationError.responseLimit();
  }

  const candidates = findCandidateObjects(text);
  if (candidates.length > MAX_PREVIEW_CANDIDATES) return null;

  const matches: TranslationDraft[] = [];
  for (const candidate of candidates) {
    const draft = await parseCandidateDraft(candidate);
    if (draft) matches.push(draft);
  }

  return matches.length === 1 ? matches[0] : null;
}
