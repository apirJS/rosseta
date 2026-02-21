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

const app = mount(App, {
  target: document.getElementById('app')!,
  props: { authUseCases, preferencesUseCases, translationUseCases },
});

export default app;
