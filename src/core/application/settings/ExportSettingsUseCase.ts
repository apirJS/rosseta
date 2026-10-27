import type { IExportSettingsUseCase } from '../../ports/inbound/settings/IExportSettingsUseCase';
import type { ISettingsBackupStorage } from '../../ports/outbound/ISettingsBackupStorage';
import type { SettingsBackupData } from '../../domain/settings/SettingsBackup';
import { failure, success, type Result } from '../../../shared/types/Result';
import { AppError, ErrorCode } from '../../../shared/errors';

export class ExportSettingsUseCase implements IExportSettingsUseCase {
  constructor(private readonly storage: ISettingsBackupStorage) {}

  async execute(): Promise<Result<SettingsBackupData, AppError>> {
    try {
      const result = await this.storage.read();

      if (!result.success) return result;

      const settings = result.data;

      return success({
        format: 'rosseta-settings',
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: {
          apiKeys: settings.credentials.items.map((credential) => ({
            id: credential.id,
            provider: credential.provider,
            apiKey: credential.apiKey.value,
          })),
          activeKeyId: settings.credentials.activeCredentialId,
          preferences: {
            ...settings.preferences,
            selectedModels: { ...settings.preferences.selectedModels },
          },
          customProviders: settings.customProviders.map((provider) =>
            provider.toProps(),
          ),
          models: Object.fromEntries(
            Object.entries(settings.models).map(([provider, models]) => [
              provider,
              models.map((model) => ({ ...model })),
            ]),
          ),
          history: (settings.history ?? []).map((translation) =>
            translation.toProps(),
          ),
          keySelection: {
            mode: settings.keySelectionMode.value,
            lastUsedKeyIds: { ...settings.lastUsedKeyIds },
          },
        },
      });
    } catch (error) {
      return failure(
        AppError.fromUnknown(error, ErrorCode.STORAGE_READ_FAILED),
      );
    }
  }
}
