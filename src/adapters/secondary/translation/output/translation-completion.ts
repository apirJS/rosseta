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

  if (new TextEncoder().encode(raw).byteLength > MAX_TRANSLATION_BYTES) {
    return { kind: 'failed', error: TranslationError.responseLimit() };
  }

  if (generated.finishReason === 'content-filter') {
    return { kind: 'failed', error: TranslationError.contentBlocked() };
  }

  if (!raw.trim() && generated.output === undefined) {
    return { kind: 'failed', error: TranslationError.emptyResponse() };
  }

  const parsed =
    generated.output !== undefined
      ? normalizeTranslationResponse(generated.output, includeDescription)
      : parseTranslationResponse(raw, includeDescription);

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
