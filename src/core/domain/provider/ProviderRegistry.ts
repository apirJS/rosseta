import type { Provider } from '../credential/Provider';
import type { KnownLanguageCode } from '../translation/LANGUAGE_MAP';

/**
 * Describes the capabilities and defaults for a single AI provider.
 * Adding a new provider only requires creating a new ProviderConfig
 * and calling ProviderRegistry.register().
 */
export interface ProviderConfig {
  id: Provider;
  name: string;
  defaultModelId: string;
  models: Array<{ id: string; name: string }>;
  supportedLanguages: KnownLanguageCode[];
}

/**
 * Single source of truth for all provider/model metadata.
 *
 * Consumers should query this registry instead of hard-coding
 * provider-specific switch statements.
 */
export class ProviderRegistry {
  private static readonly configs = new Map<Provider, ProviderConfig>();

  static register(config: ProviderConfig): void {
    this.configs.set(config.id, config);
  }

  static getConfig(provider: Provider): ProviderConfig {
    const config = this.configs.get(provider);
    if (!config) throw new Error(`Unknown provider: ${provider}`);
    return config;
  }

  static getDefaultModelId(provider: Provider): string {
    return this.getConfig(provider).defaultModelId;
  }

  static getModelsForProvider(
    provider: Provider,
  ): Array<{ id: string; name: string }> {
    return this.getConfig(provider).models;
  }

  static getSupportedLanguages(provider: Provider): KnownLanguageCode[] {
    return this.getConfig(provider).supportedLanguages;
  }

  /**
   * Flat lookup of every registered model across all providers.
   * Used by AiModel.create() and AiModel.fromRaw() for validation.
   */
  static getAllModelEntries(): Record<
    string,
    { name: string; provider: Provider }
  > {
    const entries: Record<string, { name: string; provider: Provider }> = {};
    for (const config of this.configs.values()) {
      for (const model of config.models) {
        entries[model.id] = { name: model.name, provider: config.id };
      }
    }
    return entries;
  }
}

// ── Provider Registrations ──────────────────────────────────────────

ProviderRegistry.register({
  id: 'gemini',
  name: 'Google Gemini',
  defaultModelId: 'gemini-2.5-flash-lite',
  models: [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    {
      id: 'gemini-2.5-flash-lite-preview-09-2025',
      name: 'Gemini 2.5 Flash Lite (Preview 09-2025)',
    },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  ],
  supportedLanguages: [
    'af-ZA',
    'sq-AL',
    'am-ET',
    'ar-SA',
    'hy-AM',
    'as-IN',
    'az-AZ',
    'eu-ES',
    'be-BY',
    'bn-IN',
    'bs-BA',
    'bg-BG',
    'ca-ES',
    'ceb-PH',
    'zh-CN',
    'zh-TW',
    'co-FR',
    'hr-HR',
    'cs-CZ',
    'da-DK',
    'dv-MV',
    'nl-NL',
    'en-US',
    'eo-001',
    'et-EE',
    'fil-PH',
    'fi-FI',
    'fr-FR',
    'fy-NL',
    'gl-ES',
    'ka-GE',
    'de-DE',
    'el-GR',
    'gu-IN',
    'ht-HT',
    'ha-NG',
    'haw-US',
    'he-IL',
    'hi-IN',
    'hmn-CN',
    'hu-HU',
    'is-IS',
    'ig-NG',
    'id-ID',
    'ga-IE',
    'it-IT',
    'ja-JP',
    'jv-ID',
    'kn-IN',
    'kk-KZ',
    'km-KH',
    'ko-KR',
    'kri-SL',
    'ku-TR',
    'ky-KG',
    'lo-LA',
    'la-VA',
    'lv-LV',
    'lt-LT',
    'lb-LU',
    'mk-MK',
    'mg-MG',
    'ms-MY',
    'ml-IN',
    'mt-MT',
    'mi-NZ',
    'mr-IN',
    'mni-IN',
    'mn-MN',
    'my-MM',
    'ne-NP',
    'no-NO',
    'ny-MW',
    'or-IN',
    'ps-AF',
    'fa-IR',
    'pl-PL',
    'pt-PT',
    'pa-IN',
    'ro-RO',
    'ru-RU',
    'sm-WS',
    'gd-GB',
    'sr-RS',
    'st-ZA',
    'sn-ZW',
    'sd-PK',
    'si-LK',
    'sk-SK',
    'sl-SI',
    'so-SO',
    'es-ES',
    'su-ID',
    'sw-KE',
    'sv-SE',
    'tg-TJ',
    'ta-IN',
    'te-IN',
    'th-TH',
    'tr-TR',
    'uk-UA',
    'ur-PK',
    'ug-CN',
    'uz-UZ',
    'vi-VN',
    'cy-GB',
    'xh-ZA',
    'yi-001',
    'yo-NG',
    'zu-ZA',
  ],
});

ProviderRegistry.register({
  id: 'groq',
  name: 'Groq',
  defaultModelId: 'meta-llama/llama-4-maverick-17b-128e-instruct',
  models: [
    {
      id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      name: 'Llama 4 Maverick',
    },
    {
      id: 'meta-llama/llama-4-scout-17b-16e-instruct',
      name: 'Llama 4 Scout',
    },
  ],
  supportedLanguages: [
    'ar-SA',
    'en-US',
    'fr-FR',
    'de-DE',
    'hi-IN',
    'id-ID',
    'it-IT',
    'pt-PT',
    'es-ES',
    'fil-PH',
    'th-TH',
    'vi-VN',
  ],
});
