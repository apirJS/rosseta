import type { ThemeValue } from '../preferences/Theme';
import type { LanguageCode } from '../translation/Language';
import { Language } from '../translation/Language';
import {
  Translation,
  type TranslationProps,
} from '../translation/Translation';
import { TextSegment } from '../translation/TextSegment';
import { UserPreferences } from '../preferences/UserPreferences';
import {
  CustomProviderConfig,
  type CustomProviderType,
  type CustomProviderConfigProps,
} from '../provider/CustomProviderConfig';
import { Credentials } from '../credential/Credentials';
import { KeySelectionMode } from '../credential/KeySelectionMode';
import {
  PROVIDERS,
  isAnyProvider,
  type AnyProvider,
} from '../credential/Provider';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';

export interface SettingsApiKey {
  id: string;
  provider: string;
  apiKey: string;
}

export interface SettingsPreferences {
  theme: ThemeValue;
  targetLanguage: LanguageCode;
  selectedModels: Record<string, string>;
  includeDescription: boolean;
}

export interface SettingsModel {
  id: string;
  name: string;
  source: 'fetched' | 'manual';
}

export interface SettingsBackupData {
  format: 'rosseta-settings';
  version: 1;
  exportedAt: string;
  settings: {
    apiKeys: SettingsApiKey[];
    activeKeyId: string | null;
    preferences: SettingsPreferences;
    customProviders: CustomProviderConfigProps[];
    models: Record<string, SettingsModel[]>;
    history: TranslationProps[];
    keySelection: {
      mode: string;
      lastUsedKeyIds: Record<string, string>;
    };
  };
}

export interface ValidatedSettingsBackup {
  credentials: Credentials;
  preferences: SettingsPreferences;
  customProviders: CustomProviderConfig[];
  models: Record<string, SettingsModel[]>;
  history: Translation[] | null;
  keySelectionMode: KeySelectionMode;
  lastUsedKeyIds: Record<string, string>;
}

function asRecord(
  value: unknown,
  label: string,
): Result<Record<string, unknown>, DomainError> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return failure(new DomainError(`${label} must be an object`));
  }
  return success(value as Record<string, unknown>);
}

function asStringRecord(
  value: unknown,
  label: string,
): Result<Record<string, string>, DomainError> {
  const recordResult = asRecord(value, label);
  if (!recordResult.success) return recordResult;

  const output: Record<string, string> = {};
  for (const [key, entry] of Object.entries(recordResult.data)) {
    if (typeof entry !== 'string') {
      return failure(new DomainError(`${label}.${key} must be a string`));
    }
    output[key] = entry;
  }
  return success(output);
}

function optionalStringRecord(
  value: unknown,
  label: string,
): Result<Record<string, string> | undefined, DomainError> {
  if (value === undefined) return success(undefined);
  return asStringRecord(value, label);
}

function parseSegments(
  value: unknown,
  label: string,
): Result<TextSegment[], DomainError> {
  if (!Array.isArray(value)) {
    return failure(new DomainError(`${label} must be an array`));
  }

  const segments: TextSegment[] = [];
  for (const [index, entry] of value.entries()) {
    const recordResult = asRecord(entry, `${label}[${index}]`);
    if (!recordResult.success) return recordResult;
    const record = recordResult.data;
    if (
      typeof record.text !== 'string' ||
      typeof record.languageCode !== 'string' ||
      typeof record.languageName !== 'string' ||
      (record.romanization !== null &&
        typeof record.romanization !== 'string') ||
      typeof record.blockIndex !== 'number' ||
      !Number.isInteger(record.blockIndex) ||
      record.blockIndex < 0
    ) {
      return failure(new DomainError(`Invalid segment at ${label}[${index}]`));
    }

    const languageResult = Language.fromRaw(record.languageCode);
    if (!languageResult.success) return failure(languageResult.error);
    const segmentResult = TextSegment.create(
      record.text,
      languageResult.data,
      record.romanization,
      record.blockIndex,
    );
    if (!segmentResult.success) return failure(segmentResult.error);
    segments.push(segmentResult.data);
  }

  return success(segments);
}

export function parseSettingsBackup(
  raw: unknown,
): Result<ValidatedSettingsBackup, DomainError> {
  const rootResult = asRecord(raw, 'Settings file');
  if (!rootResult.success) return rootResult;
  const root = rootResult.data;

  if (root.format !== 'rosseta-settings' || root.version !== 1) {
    return failure(
      new DomainError('This is not a supported Rosseta settings file'),
    );
  }

  const settingsResult = asRecord(root.settings, 'settings');
  if (!settingsResult.success) return settingsResult;
  const settings = settingsResult.data;

  if (!Array.isArray(settings.customProviders)) {
    return failure(new DomainError('customProviders must be an array'));
  }
  const customProviders: CustomProviderConfig[] = [];
  const customProviderIds = new Set<string>();
  for (const [index, entry] of settings.customProviders.entries()) {
    const recordResult = asRecord(entry, `customProviders[${index}]`);
    if (!recordResult.success) return recordResult;
    const record = recordResult.data;
    if (
      typeof record.id !== 'string' ||
      typeof record.name !== 'string' ||
      typeof record.baseURL !== 'string'
    ) {
      return failure(
        new DomainError(
          `customProviders[${index}] must contain string id, name, and baseURL values`,
        ),
      );
    }

    const customProviderType =
      record.type === undefined ? undefined : record.type;
    if (
      customProviderType !== undefined &&
      customProviderType !== 'openai-compatible' &&
      customProviderType !== 'anthropic'
    ) {
      return failure(
        new DomainError(`customProviders[${index}].type is invalid`),
      );
    }

    const headersResult = optionalStringRecord(
      record.headers,
      `customProviders[${index}].headers`,
    );
    if (!headersResult.success) return headersResult;
    const queryParamsResult = optionalStringRecord(
      record.queryParams,
      `customProviders[${index}].queryParams`,
    );
    if (!queryParamsResult.success) return queryParamsResult;

    const configResult = CustomProviderConfig.create({
      id: record.id,
      name: record.name,
      baseURL: record.baseURL,
      type: customProviderType as CustomProviderType | undefined,
      headers: headersResult.data,
      queryParams: queryParamsResult.data,
    });
    if (!configResult.success) return failure(configResult.error);
    if (customProviderIds.has(configResult.data.id)) {
      return failure(
        new DomainError(`Duplicate custom provider: ${configResult.data.id}`),
      );
    }
    customProviderIds.add(configResult.data.id);
    customProviders.push(configResult.data);
  }

  const providerIds = new Set<string>([...PROVIDERS, ...customProviderIds]);

  if (!Array.isArray(settings.apiKeys)) {
    return failure(new DomainError('apiKeys must be an array'));
  }
  const credentialItems: Array<{
    id: string;
    type: 'API_KEY';
    provider: AnyProvider;
    apiKey: string;
  }> = [];
  const credentialIds = new Set<string>();
  for (const [index, entry] of settings.apiKeys.entries()) {
    const recordResult = asRecord(entry, `apiKeys[${index}]`);
    if (!recordResult.success) return recordResult;
    const record = recordResult.data;
    if (
      typeof record.id !== 'string' ||
      typeof record.provider !== 'string' ||
      typeof record.apiKey !== 'string'
    ) {
      return failure(
        new DomainError(
          `apiKeys[${index}] must contain string id, provider, and apiKey values`,
        ),
      );
    }
    if (!providerIds.has(record.provider) || !isAnyProvider(record.provider)) {
      continue;
    }
    if (credentialIds.has(record.id)) {
      return failure(new DomainError(`Duplicate API key id: ${record.id}`));
    }
    credentialIds.add(record.id);
    credentialItems.push({
      id: record.id,
      type: 'API_KEY',
      provider: toAnyProvider(record.provider),
      apiKey: record.apiKey,
    });
  }

  if (
    settings.activeKeyId !== null &&
    typeof settings.activeKeyId !== 'string'
  ) {
    return failure(new DomainError('activeKeyId must be a string or null'));
  }
  const activeKeyId =
    typeof settings.activeKeyId === 'string' &&
    credentialIds.has(settings.activeKeyId)
      ? settings.activeKeyId
      : null;
  const credentialsResult = Credentials.fromProps({
    id: 'settings-import',
    activeCredentialId: activeKeyId,
    items: credentialItems,
  });
  if (!credentialsResult.success) return failure(credentialsResult.error);

  const preferencesResult = asRecord(settings.preferences, 'preferences');
  if (!preferencesResult.success) return preferencesResult;
  const preferencesRaw = preferencesResult.data;
  const selectedModelsResult = asStringRecord(
    preferencesRaw.selectedModels,
    'preferences.selectedModels',
  );
  if (!selectedModelsResult.success) return selectedModelsResult;
  const selectedModels = Object.fromEntries(
    Object.entries(selectedModelsResult.data).filter(([provider]) =>
      providerIds.has(provider),
    ),
  );
  if (
    typeof preferencesRaw.theme !== 'string' ||
    typeof preferencesRaw.targetLanguage !== 'string' ||
    typeof preferencesRaw.includeDescription !== 'boolean'
  ) {
    return failure(
      new DomainError(
        'preferences must contain theme, targetLanguage, selectedModels, and includeDescription',
      ),
    );
  }
  const userPreferencesResult = UserPreferences.fromRaw({
    id: 'settings-import',
    theme: preferencesRaw.theme,
    targetLanguage: preferencesRaw.targetLanguage,
    selectedModels,
    includeDescription: preferencesRaw.includeDescription,
  });
  if (!userPreferencesResult.success) {
    return failure(userPreferencesResult.error);
  }
  const preferencesProps = userPreferencesResult.data.toProps();
  const preferences: SettingsPreferences = {
    theme: preferencesProps.theme,
    targetLanguage: preferencesProps.targetLanguage,
    selectedModels: preferencesProps.selectedModels,
    includeDescription: preferencesProps.includeDescription,
  };

  const modelsResult = asRecord(settings.models, 'models');
  if (!modelsResult.success) return modelsResult;
  const models: Record<string, SettingsModel[]> = {};
  for (const [provider, entries] of Object.entries(modelsResult.data)) {
    if (!providerIds.has(provider)) {
      continue;
    }
    if (!Array.isArray(entries)) {
      return failure(new DomainError(`models.${provider} must be an array`));
    }
    models[provider] = [];
    for (const [index, entry] of entries.entries()) {
      const recordResult = asRecord(entry, `models.${provider}[${index}]`);
      if (!recordResult.success) return recordResult;
      const record = recordResult.data;
      if (
        typeof record.id !== 'string' ||
        !record.id.trim() ||
        typeof record.name !== 'string' ||
        !record.name.trim() ||
        (record.source !== 'fetched' && record.source !== 'manual')
      ) {
        return failure(
          new DomainError(`Invalid model at models.${provider}[${index}]`),
        );
      }
      models[provider].push({
        id: record.id.trim(),
        name: record.name.trim(),
        source: record.source,
      });
    }
  }

  const historyRaw = settings.history ?? [];
  if (!Array.isArray(historyRaw)) {
    return failure(new DomainError('history must be an array'));
  }
  const history: Translation[] = [];
  const historyIds = new Set<string>();
  for (const [index, entry] of historyRaw.entries()) {
    const recordResult = asRecord(entry, `history[${index}]`);
    if (!recordResult.success) return recordResult;
    const record = recordResult.data;
    if (
      typeof record.id !== 'string' ||
      !record.id.trim() ||
      typeof record.description !== 'string' ||
      typeof record.createdAt !== 'string'
    ) {
      return failure(new DomainError(`Invalid translation at history[${index}]`));
    }
    if (historyIds.has(record.id)) {
      return failure(new DomainError(`Duplicate translation id: ${record.id}`));
    }

    const originalResult = parseSegments(
      record.original,
      `history[${index}].original`,
    );
    if (!originalResult.success) return originalResult;
    const translatedResult = parseSegments(
      record.translated,
      `history[${index}].translated`,
    );
    if (!translatedResult.success) return translatedResult;
    const createdAt = new Date(record.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return failure(
        new DomainError(`Invalid createdAt at history[${index}]`),
      );
    }

    historyIds.add(record.id);
    history.push(
      Translation.create(
        record.id,
        originalResult.data,
        translatedResult.data,
        record.description,
        createdAt,
      ),
    );
  }

  const keySelectionResult = asRecord(
    settings.keySelection,
    'keySelection',
  );
  if (!keySelectionResult.success) return keySelectionResult;
  if (typeof keySelectionResult.data.mode !== 'string') {
    return failure(new DomainError('keySelection.mode must be a string'));
  }
  const modeResult = KeySelectionMode.fromRaw(keySelectionResult.data.mode);
  if (!modeResult.success) return failure(modeResult.error);
  const autoProvider = modeResult.data.autoBalanceProvider;
  const keySelectionMode =
    autoProvider &&
    providerIds.has(autoProvider) &&
    credentialsResult.data.getByProvider(autoProvider).length >= 2
      ? modeResult.data
      : KeySelectionMode.manual();

  const lastUsedResult = asStringRecord(
    keySelectionResult.data.lastUsedKeyIds,
    'keySelection.lastUsedKeyIds',
  );
  if (!lastUsedResult.success) return lastUsedResult;
  const lastUsedKeyIds: Record<string, string> = {};
  for (const [provider, credentialId] of Object.entries(lastUsedResult.data)) {
    if (!providerIds.has(provider)) continue;
    const credential = credentialsResult.data.items.find(
      (candidate) => candidate.id === credentialId,
    );
    if (!credential || credential.provider !== provider) continue;
    lastUsedKeyIds[provider] = credentialId;
  }

  return success({
    credentials: credentialsResult.data,
    preferences,
    customProviders,
    models,
    history: settings.history === undefined ? null : history,
    keySelectionMode,
    lastUsedKeyIds,
  });
}

function toAnyProvider(value: string): AnyProvider {
  if (!isAnyProvider(value)) {
    throw new Error(`Unknown provider: ${value}`);
  }
  return value;
}
