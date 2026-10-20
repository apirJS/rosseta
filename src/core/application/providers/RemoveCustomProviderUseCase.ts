import type { IRemoveCustomProviderUseCase } from '../../ports/inbound/providers/IRemoveCustomProviderUseCase';
import type { ICustomProviderStorage } from '../../ports/outbound/ICustomProviderStorage';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import type { IModelStorage } from '../../ports/outbound/IModelStorage';
import type { IUserPreferencesStorage } from '../../ports/outbound/IUserPreferencesStorage';
import type { IKeySelectionStorage } from '../../ports/outbound/IKeySelectionStorage';
import type { IProviderMutationLock } from '../../ports/outbound/IProviderMutationLock';
import { isCustomProviderId } from '../../domain/provider/CustomProviderConfig';
import type { AnyProvider } from '../../domain/credential/Provider';
import { KeySelectionMode } from '../../domain/credential/KeySelectionMode';
import type { Credentials } from '../../domain/credential/Credentials';
import type { UserPreferences } from '../../domain/preferences/UserPreferences';
import { failure, success, type Result } from '../../../shared/types/Result';
import { ValidationError, type AppError } from '../../../shared/errors';

interface ProviderData {
  credentials: Credentials | null;
  preferences: UserPreferences | null;
  keySelectionMode: KeySelectionMode;
}

export class RemoveCustomProviderUseCase implements IRemoveCustomProviderUseCase {
  constructor(
    private readonly storage: ICustomProviderStorage,
    private readonly credentialStorage: ICredentialStorage,
    private readonly modelStorage: IModelStorage,
    private readonly preferencesStorage: IUserPreferencesStorage,
    private readonly keySelectionStorage: IKeySelectionStorage,
    private readonly mutationLock: IProviderMutationLock,
  ) {}

  async execute(id: string): Promise<Result<void, AppError>> {
    if (!isCustomProviderId(id)) {
      return failure(
        ValidationError.invalidInput('Only custom providers can be removed.'),
      );
    }

    return this.mutationLock.run(id, () => this.removeProviderData(id));
  }

  private async removeProviderData(
    id: AnyProvider,
  ): Promise<Result<void, AppError>> {
    const dataResult = await this.loadRelatedData();

    if (!dataResult.success) return failure(dataResult.error);

    const data = dataResult.data;

    const keysResult = await this.removeCredentials(id, data.credentials);

    if (!keysResult.success) return keysResult;

    const modelsResult = await this.modelStorage.clearModels(id);

    if (!modelsResult.success) return modelsResult;

    const preferencesResult = await this.clearSelectedModel(
      id,
      data.preferences,
    );

    if (!preferencesResult.success) return preferencesResult;

    const selectionResult = await this.clearKeySelection(
      id,
      data.keySelectionMode,
    );

    if (!selectionResult.success) return selectionResult;

    // Keep the configuration available for retry until all associated data is gone.
    return this.storage.remove(id);
  }

  private async loadRelatedData(): Promise<Result<ProviderData, AppError>> {
    const credentialsResult = await this.credentialStorage.get();

    if (!credentialsResult.success) return failure(credentialsResult.error);

    const preferencesResult = await this.preferencesStorage.get();

    if (!preferencesResult.success) return failure(preferencesResult.error);

    const selectionResult = await this.keySelectionStorage.getMode();

    if (!selectionResult.success) return failure(selectionResult.error);

    return success({
      credentials: credentialsResult.data,
      preferences: preferencesResult.data,
      keySelectionMode: selectionResult.data,
    });
  }

  private async removeCredentials(
    id: string,
    credentials: Credentials | null,
  ): Promise<Result<void, AppError>> {
    if (!credentials) return success(undefined);

    const providerCredentials = credentials.getByProvider(id);

    if (providerCredentials.length === 0) return success(undefined);

    let updated = providerCredentials.reduce(
      (current, credential) => current.remove(credential.id),
      credentials,
    );

    const deepseekKey = updated.getByProvider('deepseek')[0];

    if (credentials.getActive()?.provider === id && deepseekKey) {
      const activeResult = updated.setActive(deepseekKey.id);

      if (!activeResult.success) {
        return failure(
          ValidationError.invalidInput(activeResult.error.message),
        );
      }

      updated = activeResult.data;
    }

    return this.credentialStorage.save(updated);
  }

  private async clearSelectedModel(
    id: string,
    preferences: UserPreferences | null,
  ): Promise<Result<void, AppError>> {
    if (!preferences || !Object.hasOwn(preferences.selectedModels, id))
      return success(undefined);

    const { [id]: _removed, ...selectedModels } = preferences.selectedModels;

    return this.preferencesStorage.set({ selectedModels });
  }

  private async clearKeySelection(
    id: AnyProvider,
    mode: KeySelectionMode,
  ): Promise<Result<void, AppError>> {
    if (mode.autoBalanceProvider === id) {
      const modeResult = await this.keySelectionStorage.setMode(
        KeySelectionMode.manual(),
      );

      if (!modeResult.success) return modeResult;
    }

    return this.keySelectionStorage.clearLastUsedId(id);
  }
}
