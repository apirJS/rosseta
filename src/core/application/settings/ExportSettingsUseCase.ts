import type { IExportSettingsUseCase } from '../../ports/inbound/settings/IExportSettingsUseCase';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import type { IModelStorage } from '../../ports/outbound/IModelStorage';
import type { ICustomProviderStorage } from '../../ports/outbound/ICustomProviderStorage';
import type { IKeySelectionStorage } from '../../ports/outbound/IKeySelectionStorage';
import type { ITranslationStorage } from '../../ports/outbound/ITranslationStorage';
import type {
  SettingsBackupData,
  SettingsPreferences,
} from '../../domain/settings/SettingsBackup';
import { failure, success, type Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class ExportSettingsUseCase implements IExportSettingsUseCase {
  constructor(
    private readonly credentialStorage: ICredentialStorage,
    private readonly modelStorage: IModelStorage,
    private readonly customProviderStorage: ICustomProviderStorage,
    private readonly keySelectionStorage: IKeySelectionStorage,
    private readonly translationStorage: ITranslationStorage,
  ) {}

  async execute(
    preferences: SettingsPreferences,
  ): Promise<Result<SettingsBackupData, AppError>> {
    const [
      credentialsResult,
      modelsResult,
      providersResult,
      modeResult,
      idsResult,
      historyResult,
    ] = await Promise.all([
      this.credentialStorage.get(),
      this.modelStorage.getAllModels(),
      this.customProviderStorage.load(),
      this.keySelectionStorage.getMode(),
      this.keySelectionStorage.getAllLastUsedIds(),
      this.translationStorage.getAll(),
    ]);

    if (!credentialsResult.success) return failure(credentialsResult.error);
    if (!modelsResult.success) return failure(modelsResult.error);
    if (!providersResult.success) return failure(providersResult.error);
    if (!modeResult.success) return failure(modeResult.error);
    if (!idsResult.success) return failure(idsResult.error);
    if (!historyResult.success) return failure(historyResult.error);

    const credentials = credentialsResult.data;
    return success({
      format: 'rosseta-settings',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        apiKeys:
          credentials?.items.map((credential) => ({
            id: credential.id,
            provider: credential.provider,
            apiKey: credential.apiKey.value,
          })) ?? [],
        activeKeyId: credentials?.activeCredentialId ?? null,
        preferences: {
          ...preferences,
          selectedModels: { ...preferences.selectedModels },
        },
        customProviders: providersResult.data.map((provider) =>
          provider.toProps(),
        ),
        models: modelsResult.data,
        history: historyResult.data.map((translation) =>
          translation.toProps(),
        ),
        keySelection: {
          mode: modeResult.data.value,
          lastUsedKeyIds: idsResult.data,
        },
      },
    });
  }
}
