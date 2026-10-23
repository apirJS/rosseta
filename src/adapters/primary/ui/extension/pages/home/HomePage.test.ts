import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { Credentials } from '../../../../../../core/domain/credential/Credentials';
import { AuthState } from '../../state/useAuth.svelte';
import { PreferencesState } from '../../state/usePreferences.svelte';
import { CustomProvidersState } from '../../state/useCustomProviders.svelte';
import { ModelsState } from '../../state/useModels.svelte';
import { createPopupNavigationController } from '../../PopupNavigationController.svelte';
import HomePage from './HomePage.svelte';

const contexts = vi.hoisted(() => ({
  auth: vi.fn(),
  preferences: vi.fn(),
  models: vi.fn(),
  providers: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../../context', () => ({
  getAuthStateContext: contexts.auth,
  getPreferencesStateContext: contexts.preferences,
  getModelsStateContext: contexts.models,
  getCustomProvidersStateContext: contexts.providers,
  getPopupToastContext: contexts.toast,
}));

vi.mock('webextension-polyfill', () => ({
  default: { runtime: { getManifest: () => ({ version: '1.0.0' }) } },
}));

vi.mock('../../browser/shortcut-settings', () => ({
  openShortcutSettings: vi.fn(),
  shortcutSettingsUrl: () => 'chrome://extensions/shortcuts',
}));

afterEach(cleanup);

function setup() {
  const credentials = Credentials.fromProps({
    id: 'keys',
    activeCredentialId: 'google-key',
    items: [
      {
        id: 'google-key',
        provider: 'google',
        type: 'API_KEY',
        apiKey: 'synthetic-google-key',
      },
    ],
  });

  if (!credentials.success) throw credentials.error;

  const auth = new AuthState();

  auth.credentials = credentials.data;

  const preferences = new PreferencesState();

  preferences.loaded = true;
  preferences.shortcut = 'Ctrl+Shift+Y';
  preferences.selectedModels = { google: 'vision-model' };

  const models = new ModelsState();

  models.byProvider = {
    google: [{ id: 'vision-model', name: 'Vision model', source: 'manual' }],
  };

  const providers = new CustomProvidersState();

  providers.hydrated = true;

  contexts.auth.mockReturnValue({
    state: auth,
    setActiveKey: vi.fn(),
    setKeySelectionMode: vi.fn(),
  });

  contexts.preferences.mockReturnValue({
    state: preferences,
    setSelectedModelFor: vi.fn(),
    setTargetLanguage: vi.fn(),
    setIncludeDescription: vi.fn(),
    toggleTheme: vi.fn(),
  });

  contexts.models.mockReturnValue({
    modelsFor: (provider: string) => models.byProvider[provider] ?? [],
  });

  contexts.providers.mockReturnValue({
    state: providers,
    getProvider: () => null,
    options: [
      { value: 'google', label: 'Google' },
      { value: 'groq', label: 'Groq' },
    ],
  });

  contexts.toast.mockReturnValue({ show: vi.fn() });

  const navigation = createPopupNavigationController();

  return { ...render(HomePage, { navigation }), navigation, auth, models };
}

describe('UI: home wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  test('renders supplied configuration and disables translation when a provider has no keys or models', async () => {
    const view = setup();

    expect((view.getByLabelText('Model') as HTMLSelectElement).value).toBe(
      'vision-model',
    );

    expect(
      view.getByRole('button', { name: /Translate/ }).hasAttribute('disabled'),
    ).toBe(false);

    expect(view.getByText('(Ctrl+Shift+Y)')).toBeDefined();

    await fireEvent.change(view.container.querySelector('#provider-select')!, {
      target: { value: 'groq' },
    });

    expect(view.navigation.state.selectedProvider).toBe('groq');

    expect(
      view.getByRole('button', { name: /Translate/ }).hasAttribute('disabled'),
    ).toBe(true);

    expect((view.getByLabelText('Model') as HTMLSelectElement).disabled).toBe(
      true,
    );
  });

  test('navigates from the home menu with the effective provider', async () => {
    const view = setup();

    await fireEvent.click(view.getByRole('button', { name: 'Menu' }));
    await fireEvent.click(view.getByRole('button', { name: /Manage Models/i }));
    expect(view.navigation.state.currentView).toBe('manage-models');
    expect(view.navigation.state.selectedProvider).toBe('google');
    expect(view.navigation.state.isMenuOpen).toBe(false);
  });
});
