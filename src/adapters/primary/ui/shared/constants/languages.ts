import type { Provider } from '../../../../../core/domain/credential/Provider';
import {
  LANGUAGE_MAP,
  type KnownLanguageCode,
} from '../../../../../core/domain/translation/LANGUAGE_MAP';
import { ProviderRegistry } from '../../../../../core/domain/provider/ProviderRegistry';

/** Internal-only language codes that should not appear in the language selector */
const HIDDEN_LANGUAGE_CODES = new Set(['unknown', 'number', 'symbol']);

export function getLanguageOptions(provider?: Provider) {
  const providerCodes: KnownLanguageCode[] | undefined = provider
    ? ProviderRegistry.getSupportedLanguages(provider)
    : undefined;

  return Object.entries(LANGUAGE_MAP)
    .filter(([code]) => !HIDDEN_LANGUAGE_CODES.has(code))
    .filter(
      ([code]) =>
        !providerCodes || providerCodes.includes(code as KnownLanguageCode),
    )
    .map(([code, name]) => ({
      code: code as KnownLanguageCode,
      name,
    }));
}

export type LanguageCode = KnownLanguageCode;
