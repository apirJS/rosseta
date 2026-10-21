import {
  ErrorCode,
  TranslationError,
  type AppError,
} from '../../../../shared/errors';
import type { GenerationResult } from '../transports/GenerationTransport';
import { MAX_TRANSLATION_BYTES } from '../preview/parse-partial-translation-json';
import { parseTranslationResponse } from './parse-translation-json';
import { normalizeTranslationResponse } from './translation-response-normalizer';
import type { TranslationResponse } from './translation-schema';

export type TranslationCompletion =
  | { kind: 'accepted'; response: TranslationResponse }
  | { kind: 'incomplete'; text: string; finishReason: string }
  | { kind: 'failed'; error: AppError };

/** Final validation is independent of provisional parsing and retry policy. */
export function inspectTranslationCompletion(
  generated: GenerationResult,
  streamedText: string,
  includeDescription: boolean,
): TranslationCompletion {
  const raw = generated.text || streamedText;
  const texts = [...new Set([generated.text, streamedText])];

  if (
    texts.some(
      (text) =>
        new TextEncoder().encode(text).byteLength > MAX_TRANSLATION_BYTES,
    )
  ) {
    return { kind: 'failed', error: TranslationError.responseLimit() };
  }

  if (generated.finishReason === 'content-filter') {
    return { kind: 'failed', error: TranslationError.contentBlocked() };
  }

  if (texts.every((text) => !text.trim()) && generated.output === undefined) {
    return { kind: 'failed', error: TranslationError.emptyResponse() };
  }

  let parsed = normalizeTranslationResponse(
    generated.output,
    includeDescription,
  );

  // SDK schema validation and transport text can disagree. Try each complete
  // representation before requesting another generation, using the same gate.
  for (const text of texts) {
    if (
      parsed.success ||
      parsed.error.code === ErrorCode.TRANSLATION_RESPONSE_LIMIT
    )
      break;

    parsed = parseTranslationResponse(text, includeDescription);
  }

  if (
    !parsed.success &&
    parsed.error.code === ErrorCode.TRANSLATION_RESPONSE_LIMIT
  ) {
    return { kind: 'failed', error: parsed.error };
  }

  if (generated.finishReason === 'stop' && parsed.success) {
    return { kind: 'accepted', response: parsed.data };
  }

  return {
    kind: 'incomplete',
    text: raw,
    finishReason: generated.finishReason,
  };
}
