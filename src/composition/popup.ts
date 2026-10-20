import { GetCredentialsUseCase } from '../core/application/credentials/GetCredentialUseCase';
import { AddApiKeyUseCase } from '../core/application/credentials/AddApiKeyUseCase';
import { RemoveApiKeyUseCase } from '../core/application/credentials/RemoveApiKeyUseCase';
import { SetActiveKeyUseCase } from '../core/application/credentials/SetActiveKeyUseCase';
import { GetKeySelectionModeUseCase } from '../core/application/credentials/GetKeySelectionModeUseCase';
import { SetKeySelectionModeUseCase } from '../core/application/credentials/SetKeySelectionModeUseCase';
import { GetPreferencesUseCase } from '../core/application/preferences/GetPreferencesUseCase';
import { UpdatePreferencesUseCase } from '../core/application/preferences/UpdatePreferencesUseCase';
import { GetAllTranslationsUseCase } from '../core/application/history/GetAllTranslationsUseCase';
import { DeleteTranslationUseCase } from '../core/application/history/DeleteTranslationUseCase';
import { ClearAllTranslationsUseCase } from '../core/application/history/ClearAllTranslationsUseCase';
import { LoadModelsUseCase } from '../core/application/providers/LoadModelsUseCase';
import { AddCustomModelUseCase } from '../core/application/providers/AddCustomModelUseCase';
import { RemoveCustomModelUseCase } from '../core/application/providers/RemoveCustomModelUseCase';
import { ClearModelsUseCase } from '../core/application/providers/ClearModelsUseCase';
import { SaveCustomProviderUseCase } from '../core/application/providers/SaveCustomProviderUseCase';
import { GetCustomProvidersUseCase } from '../core/application/providers/GetCustomProvidersUseCase';
import { RemoveCustomProviderUseCase } from '../core/application/providers/RemoveCustomProviderUseCase';
import { GetShortcutUseCase } from '../core/application/shortcuts/GetShortcutUseCase';
import { ExportSettingsUseCase } from '../core/application/settings/ExportSettingsUseCase';
import { ImportSettingsUseCase } from '../core/application/settings/ImportSettingsUseCase';
import {
  createCredentialStorage,
  createUserPreferencesStorage,
  createTranslationStorage,
  createKeySelectionStorage,
  createModelStorage,
  createCommandStorage,
  createCustomProviderStorage,
  createProviderMutationLock,
} from './storage';

export function createPopupDependencies() {
  const credentialStorage = createCredentialStorage();
  const userPreferencesStorage = createUserPreferencesStorage();
  const translationStorage = createTranslationStorage();
  const keySelectionStorage = createKeySelectionStorage();
  const modelStorage = createModelStorage();
  const commandStorage = createCommandStorage();
  const customProviderStorage = createCustomProviderStorage();

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

    getPreferencesUseCase: new GetPreferencesUseCase(userPreferencesStorage),
    updatePreferencesUseCase: new UpdatePreferencesUseCase(
      userPreferencesStorage,
    ),

    getAllTranslationsUseCase: new GetAllTranslationsUseCase(
      translationStorage,
    ),
    deleteTranslationUseCase: new DeleteTranslationUseCase(translationStorage),
    clearAllTranslationsUseCase: new ClearAllTranslationsUseCase(
      translationStorage,
    ),

    loadModelsUseCase: new LoadModelsUseCase(modelStorage),
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
      userPreferencesStorage,
      keySelectionStorage,
      createProviderMutationLock(),
    ),

    getShortcutUseCase: new GetShortcutUseCase(commandStorage),

    exportSettingsUseCase: new ExportSettingsUseCase(
      credentialStorage,
      modelStorage,
      customProviderStorage,
      keySelectionStorage,
      translationStorage,
    ),
    importSettingsUseCase: new ImportSettingsUseCase(
      credentialStorage,
      userPreferencesStorage,
      modelStorage,
      customProviderStorage,
      keySelectionStorage,
      translationStorage,
    ),
  };
}
