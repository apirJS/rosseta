import { BrowserCredentialStorageAdapter } from '../../adapters/secondary/storage/BrowserCredentialStorageAdapter';
import { BrowserUserPreferencesStorageAdapter } from '../../adapters/secondary/storage/BrowserUserPreferencesStorageAdapter';
import { BrowserTranslationStorageAdapter } from '../../adapters/secondary/storage/BrowserTranslationStorageAdapter';
import { BrowserKeySelectionStorageAdapter } from '../../adapters/secondary/storage/BrowserKeySelectionStorageAdapter';
import { BrowserModelStorageAdapter } from '../../adapters/secondary/storage/BrowserModelStorageAdapter';
import { BrowserCommandStorageAdapter } from '../../adapters/secondary/storage/BrowserCommandStorageAdapter';
import { BrowserCustomProviderStorageAdapter } from '../../adapters/secondary/storage/BrowserCustomProviderStorageAdapter';
import { ModelFetchService } from '../../adapters/secondary/model-fetchers/ModelFetchService';
import { GetCredentialsUseCase } from '../../core/application/auth/GetCredentialUseCase';
import { AddApiKeyUseCase } from '../../core/application/auth/AddApiKeyUseCase';
import { RemoveApiKeyUseCase } from '../../core/application/auth/RemoveApiKeyUseCase';
import { SetActiveKeyUseCase } from '../../core/application/auth/SetActiveKeyUseCase';
import { GetKeySelectionModeUseCase } from '../../core/application/auth/GetKeySelectionModeUseCase';
import { SetKeySelectionModeUseCase } from '../../core/application/auth/SetKeySelectionModeUseCase';
import { ResolveActiveCredentialUseCase } from '../../core/application/auth/ResolveActiveCredentialUseCase';
import { GetPreferencesUseCase } from '../../core/application/preferences/GetPreferencesUseCase';
import { UpdatePreferencesUseCase } from '../../core/application/preferences/UpdatePreferencesUseCase';
import { SaveTranslationUseCase } from '../../core/application/translation/SaveTranslationUseCase';
import { GetTranslationUseCase } from '../../core/application/translation/GetTranslationUseCase';
import { GetAllTranslationsUseCase } from '../../core/application/translation/GetAllTranslationsUseCase';
import { DeleteTranslationUseCase } from '../../core/application/translation/DeleteTranslationUseCase';
import { ClearAllTranslationsUseCase } from '../../core/application/translation/ClearAllTranslationsUseCase';
import { LoadModelsUseCase } from '../../core/application/models/LoadModelsUseCase';
import { FetchModelsUseCase } from '../../core/application/models/FetchModelsUseCase';
import { AddCustomModelUseCase } from '../../core/application/models/AddCustomModelUseCase';
import { RemoveCustomModelUseCase } from '../../core/application/models/RemoveCustomModelUseCase';
import { ClearModelsUseCase } from '../../core/application/models/ClearModelsUseCase';
import { SaveCustomProviderUseCase } from '../../core/application/provider/SaveCustomProviderUseCase';
import { GetCustomProvidersUseCase } from '../../core/application/provider/GetCustomProvidersUseCase';
import { RemoveCustomProviderUseCase } from '../../core/application/provider/RemoveCustomProviderUseCase';
import { GetShortcutUseCase } from '../../core/application/command/GetShortcutUseCase';
import type { ICredentialStorage } from '../../core/ports/outbound/ICredentialStorage';
import type { ITranslationStorage } from '../../core/ports/outbound/ITranslationStorage';
import type { IUserPreferencesStorage } from '../../core/ports/outbound/IUserPreferencesStorage';
import type { IKeySelectionStorage } from '../../core/ports/outbound/IKeySelectionStorage';
import type { IModelStorage } from '../../core/ports/outbound/IModelStorage';
import type { ICustomProviderStorage } from '../../core/ports/outbound/ICustomProviderStorage';
import type { IModelFetchService } from '../../core/ports/outbound/IModelFetchService';
import type { ICommandStorage } from '../../core/ports/outbound/ICommandStorage';

export function createContainer() {
  const credentialStorage: ICredentialStorage =
    new BrowserCredentialStorageAdapter();
  const userPreferencesStorage: IUserPreferencesStorage =
    new BrowserUserPreferencesStorageAdapter();
  const translationStorage: ITranslationStorage =
    new BrowserTranslationStorageAdapter();
  const keySelectionStorage: IKeySelectionStorage =
    new BrowserKeySelectionStorageAdapter();
  const modelStorage: IModelStorage = new BrowserModelStorageAdapter();
  const commandStorage: ICommandStorage = new BrowserCommandStorageAdapter();
  const customProviderStorage: ICustomProviderStorage =
    new BrowserCustomProviderStorageAdapter();
  const modelFetchService: IModelFetchService = new ModelFetchService();

  return {
    credentialStorage,
    userPreferencesStorage,
    translationStorage,
    keySelectionStorage,
    modelStorage,
    customProviderStorage,

    getCredentialsUseCase: new GetCredentialsUseCase(credentialStorage),
    addApiKeyUseCase: new AddApiKeyUseCase(credentialStorage),
    removeApiKeyUseCase: new RemoveApiKeyUseCase(credentialStorage),
    setActiveKeyUseCase: new SetActiveKeyUseCase(credentialStorage),
    getKeySelectionModeUseCase: new GetKeySelectionModeUseCase(
      keySelectionStorage,
    ),
    setKeySelectionModeUseCase: new SetKeySelectionModeUseCase(
      keySelectionStorage,
      credentialStorage,
    ),
    resolveActiveCredentialUseCase: new ResolveActiveCredentialUseCase(
      keySelectionStorage,
    ),

    getPreferencesUseCase: new GetPreferencesUseCase(userPreferencesStorage),
    updatePreferencesUseCase: new UpdatePreferencesUseCase(
      userPreferencesStorage,
    ),

    saveTranslationUseCase: new SaveTranslationUseCase(translationStorage),
    getTranslationUseCase: new GetTranslationUseCase(translationStorage),
    getAllTranslationsUseCase: new GetAllTranslationsUseCase(
      translationStorage,
    ),
    deleteTranslationUseCase: new DeleteTranslationUseCase(translationStorage),
    clearAllTranslationsUseCase: new ClearAllTranslationsUseCase(
      translationStorage,
    ),

    loadModelsUseCase: new LoadModelsUseCase(modelStorage),
    fetchModelsUseCase: new FetchModelsUseCase(modelStorage, modelFetchService),
    addCustomModelUseCase: new AddCustomModelUseCase(modelStorage),
    removeCustomModelUseCase: new RemoveCustomModelUseCase(modelStorage),
    clearModelsUseCase: new ClearModelsUseCase(modelStorage),

    getCustomProvidersUseCase: new GetCustomProvidersUseCase(
      customProviderStorage,
    ),
    saveCustomProviderUseCase: new SaveCustomProviderUseCase(
      customProviderStorage,
    ),
    removeCustomProviderUseCase: new RemoveCustomProviderUseCase(
      customProviderStorage,
      credentialStorage,
      modelStorage,
    ),

    getShortcutUseCase: new GetShortcutUseCase(commandStorage),
  };
}

export type Container = ReturnType<typeof createContainer>;
