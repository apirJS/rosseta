import {
  LANGUAGE_MAP,
  type KnownLanguageCode,
} from '../../../../../core/domain/translation/LANGUAGE_MAP';

const HIDDEN_LANGUAGE_CODES = new Set(['unknown', 'number', 'symbol']);

export function getLanguageOptions() {
  return Object.entries(LANGUAGE_MAP)
    .filter(([code]) => !HIDDEN_LANGUAGE_CODES.has(code))
    .map(([code, name]) => ({
      code: code as KnownLanguageCode,
      name,
    }));
}

export type LanguageCode = KnownLanguageCode;
