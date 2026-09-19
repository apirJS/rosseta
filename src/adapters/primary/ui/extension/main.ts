import { mount } from 'svelte';
import { ExtensionThemeBroadcaster } from './services/ExtensionThemeBroadcaster';
import '../styles/app.css';
import App from './App.svelte';
import { uiContainer } from './di-container';

const authUseCases = {
  addApiKey: uiContainer.addApiKeyUseCase,
  removeApiKey: uiContainer.removeApiKeyUseCase,
  getCredentials: uiContainer.getCredentialsUseCase,
  setActiveKey: uiContainer.setActiveKeyUseCase,
  getKeySelectionMode: uiContainer.getKeySelectionModeUseCase,
  setKeySelectionMode: uiContainer.setKeySelectionModeUseCase,
};

const preferencesUseCases = {
  getPreferences: uiContainer.getPreferencesUseCase,
  updatePreferences: uiContainer.updatePreferencesUseCase,
  getShortcut: uiContainer.getShortcutUseCase,
  onThemeApplied: (theme: 'dark' | 'light') => {
    ExtensionThemeBroadcaster.broadcast(theme);
  },
};

const translationUseCases = {
  getAllTranslations: uiContainer.getAllTranslationsUseCase,
  deleteTranslation: uiContainer.deleteTranslationUseCase,
  clearAllTranslations: uiContainer.clearAllTranslationsUseCase,
};

const modelUseCases = {
  addCustomModel: uiContainer.addCustomModelUseCase,
  removeCustomModel: uiContainer.removeCustomModelUseCase,
  clearModels: uiContainer.clearModelsUseCase,
  loadModels: uiContainer.loadModelsUseCase,
};

const customProviderUseCases = {
  getCustomProviders: uiContainer.getCustomProvidersUseCase,
  saveCustomProvider: uiContainer.saveCustomProviderUseCase,
  removeCustomProvider: uiContainer.removeCustomProviderUseCase,
};

const settingsUseCases = {
  exportSettings: uiContainer.exportSettingsUseCase,
  importSettings: uiContainer.importSettingsUseCase,
};

const app = mount(App, {
  target: document.getElementById('app')!,
  props: {
    authUseCases,
    preferencesUseCases,
    translationUseCases,
    modelUseCases,
    customProviderUseCases,
    settingsUseCases,
  },
});

export default app;
