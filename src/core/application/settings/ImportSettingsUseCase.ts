import type { IImportSettingsUseCase } from '../../ports/inbound/settings/IImportSettingsUseCase';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import type { IUserPreferencesStorage } from '../../ports/outbound/IUserPreferencesStorage';
import type { IModelStorage } from '../../ports/outbound/IModelStorage';
import type { ICustomProviderStorage } from '../../ports/outbound/ICustomProviderStorage';
import type { IKeySelectionStorage } from '../../ports/outbound/IKeySelectionStorage';
import type { ITranslationStorage } from '../../ports/outbound/ITranslationStorage';
import { parseSettingsBackup } from '../../domain/settings/SettingsBackup';
import { ValidationError, type AppError } from '../../../shared/errors';
import { failure, success, type Result } from '../../../shared/types/Result';

export class ImportSettingsUseCase implements IImportSettingsUseCase {
  constructor(
    private readonly credentialStorage: ICredentialStorage,
    private readonly preferencesStorage: IUserPreferencesStorage,
    private readonly modelStorage: IModelStorage,
    private readonly customProviderStorage: ICustomProviderStorage,
    private readonly keySelectionStorage: IKeySelectionStorage,
    private readonly translationStorage: ITranslationStorage,
  ) {}

  async execute(data: unknown): Promise<Result<void, AppError>> {
    const parsed = parseSettingsBackup(data);
    if (!parsed.success) {
      return failure(ValidationError.invalidInput(parsed.error.message));
    }

    const settings = parsed.data;
    const providersResult = await this.customProviderStorage.replaceAll(
      settings.customProviders,
    );
    if (!providersResult.success) return failure(providersResult.error);

    const credentialsResult = await this.credentialStorage.save(
      settings.credentials,
    );
    if (!credentialsResult.success) return failure(credentialsResult.error);

    const preferencesResult = await this.preferencesStorage.set(
      settings.preferences,
    );
    if (!preferencesResult.success) return failure(preferencesResult.error);

    const modelsResult = await this.modelStorage.replaceAllModels(
      settings.models,
    );
    if (!modelsResult.success) return failure(modelsResult.error);

    if (settings.history) {
      const historyResult = await this.translationStorage.replaceAll(
        settings.history,
      );
      if (!historyResult.success) return failure(historyResult.error);
    }

    const modeResult = await this.keySelectionStorage.setMode(
      settings.keySelectionMode,
    );
    if (!modeResult.success) return failure(modeResult.error);

    const idsResult = await this.keySelectionStorage.replaceLastUsedIds(
      settings.lastUsedKeyIds,
    );
    if (!idsResult.success) return failure(idsResult.error);

    return success(undefined);
  }
}
