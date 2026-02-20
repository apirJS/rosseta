import { BrowserCredentialStorageAdapter } from '../../adapters/secondary/storage/BrowserCredentialStorageAdapter';
import { BrowserUserPreferencesStorageAdapter } from '../../adapters/secondary/storage/BrowserUserPreferencesStorageAdapter';
import { BrowserTranslationStorageAdapter } from '../../adapters/secondary/storage/BrowserTranslationStorageAdapter';
import { BrowserKeySelectionStorageAdapter } from '../../adapters/secondary/storage/BrowserKeySelectionStorageAdapter';
import { HttpApiKeyValidator } from '../../adapters/secondary/validation/HttpApiKeyValidator';
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
import type { ICredentialStorage } from '../../core/ports/outbound/ICredentialStorage';
import type { ITranslationStorage } from '../../core/ports/outbound/ITranslationStorage';
import type { IUserPreferencesStorage } from '../../core/ports/outbound/IUserPreferencesStorage';
import type { IKeySelectionStorage } from '../../core/ports/outbound/IKeySelectionStorage';
import type { IApiKeyValidator } from '../../core/ports/outbound/IApiKeyValidator';

export function createContainer() {
  const credentialStorage: ICredentialStorage =
    new BrowserCredentialStorageAdapter();
  const userPreferencesStorage: IUserPreferencesStorage =
    new BrowserUserPreferencesStorageAdapter();
  const translationStorage: ITranslationStorage =
    new BrowserTranslationStorageAdapter();
  const keySelectionStorage: IKeySelectionStorage =
    new BrowserKeySelectionStorageAdapter();
  const apiKeyValidator: IApiKeyValidator = new HttpApiKeyValidator();

  return {
    // Adapters
    credentialStorage,
    userPreferencesStorage,
    translationStorage,
    keySelectionStorage,

    // Auth Use Cases
    getCredentialsUseCase: new GetCredentialsUseCase(credentialStorage),
    addApiKeyUseCase: new AddApiKeyUseCase(credentialStorage, apiKeyValidator),
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

    // Preferences Use Cases
    getPreferencesUseCase: new GetPreferencesUseCase(userPreferencesStorage),
    updatePreferencesUseCase: new UpdatePreferencesUseCase(
      userPreferencesStorage,
    ),

    // Translation Use Cases
    saveTranslationUseCase: new SaveTranslationUseCase(translationStorage),
    getTranslationUseCase: new GetTranslationUseCase(translationStorage),
    getAllTranslationsUseCase: new GetAllTranslationsUseCase(
      translationStorage,
    ),
    deleteTranslationUseCase: new DeleteTranslationUseCase(translationStorage),
    clearAllTranslationsUseCase: new ClearAllTranslationsUseCase(
      translationStorage,
    ),
  };
}

export type Container = ReturnType<typeof createContainer>;
