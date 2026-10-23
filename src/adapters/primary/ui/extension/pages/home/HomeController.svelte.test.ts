import { describe, expect, test, vi, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { PopupNavigationState } from '../../PopupNavigationController.svelte';
import { createHomeController, type HomeDeps } from './HomeController.svelte';
import { KeySelectionMode } from '../../../../../../core/domain/credential/KeySelectionMode';
import { getProviderDefaultModelId } from '../../../../../../core/domain/provider/provider-definitions';
import { CustomProviderConfig } from '../../../../../../core/domain/provider/CustomProviderConfig';
import { CustomProvidersState } from '../../state/useCustomProviders.svelte';
import type { Credential } from '../../../../../../core/domain/credential/Credential';
import type { Credentials } from '../../../../../../core/domain/credential/Credentials';
import type { StoredModel } from '../../../../../../core/ports/outbound/IModelStorage';

function makeCredential(provider: string, id: string): Credential {
  return { id, provider } as unknown as Credential;
}

function makeCredentials(
  items: Credential[],
  activeId: string | null = null,
): Credentials {
  return {
    items,
    getActive: () => items.find((c) => c.id === activeId) ?? null,
    getByProvider: (p: string) => items.filter((c) => c.provider === p),
  } as unknown as Credentials;
}

function makeModel(id: string): StoredModel {
  return { id, name: id, source: 'manual' };
}

function createDeps() {
  const googleKey = makeCredential('google', 'gk1');
  const groqKey = makeCredential('groq', 'rk1');

  const auth = {
    state: {
      credentials: makeCredentials([googleKey, groqKey], 'gk1'),
      keySelectionMode: KeySelectionMode.manual(),
    },
    setActiveKey: vi.fn().mockResolvedValue(null),
    setKeySelectionMode: vi.fn().mockResolvedValue(null),
  };

  const preferences = {
    state: { selectedModels: {} as Record<string, string> },
    setSelectedModelFor: vi.fn(),
  };

  const models = {
    modelsFor: vi.fn().mockReturnValue([] as StoredModel[]),
  };

  const customProviderState = new CustomProvidersState();

  customProviderState.hydrated = true;

  const customProviders = {
    state: customProviderState,
    getProvider: vi
      .fn()
      .mockImplementation(
        (id: string) =>
          customProviderState.providers.find(
            (provider) => provider.id === id,
          ) ?? null,
      ),
  };

  const toast = { show: vi.fn() };

  const deps: HomeDeps = {
    auth,
    preferences,
    models,
    customProviders,
    toast,
    providerSelection: new PopupNavigationState(),
    startCapture: vi.fn().mockResolvedValue(undefined),
    closePopup: vi.fn(),
    openShortcutSettings: vi.fn().mockResolvedValue(undefined),
    shortcutSettingsUrl: 'chrome://extensions/shortcuts',
  };

  return { deps, auth, preferences, models, customProviders, toast };
}

function createController(deps: HomeDeps) {
  let controller!: ReturnType<typeof createHomeController>;

  const cleanup = $effect.root(() => {
    controller = createHomeController(deps);
  });

  flushSync();

  return { controller, cleanup };
}

describe('UI Controller: HomeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('uses the active credential provider when the mode is manual', () => {
    const { deps } = createDeps();
    const { controller, cleanup } = createController(deps);

    expect(controller.effectiveProvider).toBe('google');

    cleanup();
  });

  test('falls back to the default provider when no credential is active', () => {
    const { deps } = createDeps();

    deps.auth.state.credentials = makeCredentials([]);

    const { controller, cleanup } = createController(deps);

    expect(controller.effectiveProvider).toBe('google');

    cleanup();
  });

  test('uses the auto-balance provider when the mode is auto-balance', () => {
    const { deps } = createDeps();

    deps.auth.state.credentials = makeCredentials(
      [
        makeCredential('google', 'gk1'),
        makeCredential('groq', 'rk1'),
        makeCredential('groq', 'rk2'),
      ],
      'gk1',
    );

    deps.auth.state.keySelectionMode = KeySelectionMode.autoBalance('groq');

    const { controller, cleanup } = createController(deps);

    expect(controller.effectiveProvider).toBe('groq');

    cleanup();
  });

  test('ignores auto-balance and keeps the active provider when the provider has one key', () => {
    const { deps } = createDeps();

    deps.auth.state.keySelectionMode = KeySelectionMode.autoBalance('groq');

    const { controller, cleanup } = createController(deps);

    expect(controller.effectiveProvider).toBe('google');

    cleanup();
  });

  test('a user-selected provider overrides the active provider', () => {
    const { deps } = createDeps();
    const { controller, cleanup } = createController(deps);

    deps.providerSelection.selectedProvider = 'groq';
    expect(controller.effectiveProvider).toBe('groq');

    cleanup();
  });

  test('changeProvider selects the provider and activates its first key', async () => {
    const { deps, auth } = createDeps();
    const { controller, cleanup } = createController(deps);

    await controller.changeProvider('groq');

    expect(deps.providerSelection.selectedProvider).toBe('groq');
    expect(auth.setActiveKey).toHaveBeenCalledWith('rk1');

    cleanup();
  });

  test('changeProvider switches to manual mode first when not manual', async () => {
    const { deps, auth } = createDeps();

    deps.auth.state.keySelectionMode = KeySelectionMode.autoBalance('google');

    const { controller, cleanup } = createController(deps);

    await controller.changeProvider('groq');

    expect(auth.setKeySelectionMode).toHaveBeenCalledWith(
      KeySelectionMode.manual(),
    );

    expect(auth.setActiveKey).toHaveBeenCalledWith('rk1');

    cleanup();
  });

  test('changeProvider ignores values that are not providers', async () => {
    const { deps, auth } = createDeps();
    const { controller, cleanup } = createController(deps);

    await controller.changeProvider('not-a-provider');

    expect(deps.providerSelection.selectedProvider).toBeNull();
    expect(auth.setActiveKey).not.toHaveBeenCalled();

    cleanup();
  });

  test('changeProvider keeps the selection when the provider has no keys', async () => {
    const { deps, auth } = createDeps();
    const { controller, cleanup } = createController(deps);

    await controller.changeProvider('xai');

    expect(deps.providerSelection.selectedProvider).toBe('xai');
    expect(auth.setActiveKey).not.toHaveBeenCalled();

    cleanup();
  });

  test('changeProvider reverts the selection and toasts when activation fails', async () => {
    const { deps, auth, toast } = createDeps();

    auth.setActiveKey = vi.fn().mockResolvedValue('Storage broken');

    const { controller, cleanup } = createController(deps);

    await controller.changeProvider('groq');

    expect(deps.providerSelection.selectedProvider).toBeNull();

    expect(toast.show).toHaveBeenCalledWith({
      type: 'error',
      message: 'Could not switch provider',
      description: 'Storage broken',
    });

    cleanup();
  });

  test('changeProvider reverts the selection on mode failure', async () => {
    const { deps, auth, toast } = createDeps();

    deps.auth.state.keySelectionMode = KeySelectionMode.autoBalance('google');
    auth.setKeySelectionMode = vi.fn().mockResolvedValue('Mode failed');

    const { controller, cleanup } = createController(deps);

    await controller.changeProvider('groq');

    expect(deps.providerSelection.selectedProvider).toBeNull();

    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Could not switch provider',
        description: 'Mode failed',
      }),
    );

    cleanup();
  });

  test('effectiveModelId prefers a saved selection present in the model list', () => {
    const { deps, models, preferences } = createDeps();

    models.modelsFor = vi
      .fn()
      .mockReturnValue([makeModel('m1'), makeModel('m2')]);

    preferences.state.selectedModels = { google: 'm2' };

    const { controller, cleanup } = createController(deps);

    expect(controller.effectiveModelId).toBe('m2');

    cleanup();
  });

  test('effectiveModelId falls back to the provider default when saved is stale', () => {
    const { deps, models, preferences } = createDeps();
    const defaultId = getProviderDefaultModelId('google');

    models.modelsFor = vi
      .fn()
      .mockReturnValue([makeModel(defaultId), makeModel('m1')]);

    preferences.state.selectedModels = { google: 'gone' };

    const { controller, cleanup } = createController(deps);

    expect(controller.effectiveModelId).toBe(defaultId);

    cleanup();
  });

  test('effectiveModelId falls back to the first model when nothing matches', () => {
    const { deps, models } = createDeps();

    models.modelsFor = vi.fn().mockReturnValue([makeModel('m1')]);

    const { controller, cleanup } = createController(deps);

    expect(controller.effectiveModelId).toBe('m1');

    cleanup();
  });

  test('canTranslate requires a key and a resolvable model', () => {
    const { deps, models } = createDeps();
    const { controller: withoutModels, cleanup: c1 } = createController(deps);

    expect(withoutModels.canTranslate).toBe(false);
    c1();

    models.modelsFor = vi.fn().mockReturnValue([makeModel('m1')]);
    deps.auth.state.credentials = makeCredentials([]);

    const { controller: withoutKeys, cleanup: c2 } = createController(deps);

    expect(withoutKeys.canTranslate).toBe(false);
    c2();

    const { deps: withBoth } = createDeps();

    withBoth.models.modelsFor = vi.fn().mockReturnValue([makeModel('m1')]);

    const { controller: ready, cleanup: c3 } = createController(withBoth);

    expect(ready.canTranslate).toBe(true);
    c3();
  });

  test('setSelectedModel delegates with the effective provider', () => {
    const { deps, preferences } = createDeps();
    const { controller, cleanup } = createController(deps);

    controller.setSelectedModel('m9');

    expect(preferences.setSelectedModelFor).toHaveBeenCalledWith(
      'google',
      'm9',
    );

    cleanup();
  });

  test('persists the effective model when it differs from the saved selection', () => {
    const { deps, models, preferences } = createDeps();

    models.modelsFor = vi.fn().mockReturnValue([makeModel('m1')]);

    const { cleanup } = createController(deps);

    expect(preferences.setSelectedModelFor).toHaveBeenCalledWith(
      'google',
      'm1',
    );

    cleanup();
  });

  test('does not persist when translation is not possible', () => {
    const { deps, preferences } = createDeps();
    const { cleanup } = createController(deps);

    expect(preferences.setSelectedModelFor).not.toHaveBeenCalled();

    cleanup();
  });

  test('auto-activates the first key when the active key belongs to another provider', () => {
    const { deps, auth } = createDeps();
    const { cleanup } = createController(deps);

    deps.providerSelection.selectedProvider = 'groq';
    flushSync();

    expect(auth.setActiveKey).toHaveBeenCalledWith('rk1');

    cleanup();
  });

  test('snaps a deleted custom selection to DeepSeek even with a stale active custom key', () => {
    const { deps } = createDeps();

    deps.auth.state.credentials = makeCredentials(
      [makeCredential('custom-gone', 'orphan')],
      'orphan',
    );

    const { controller, cleanup } = createController(deps);

    deps.providerSelection.selectedProvider = 'custom-gone';
    flushSync();

    expect(deps.providerSelection.selectedProvider).toBe('deepseek');
    expect(controller.effectiveProvider).toBe('deepseek');
    expect(controller.canTranslate).toBe(false);

    cleanup();
  });

  test('recovers a missing active custom provider when the popup reopens', () => {
    const { deps } = createDeps();

    deps.auth.state.credentials = makeCredentials(
      [makeCredential('custom-gone', 'orphan')],
      'orphan',
    );

    const { controller, cleanup } = createController(deps);

    expect(controller.effectiveProvider).toBe('deepseek');
    expect(deps.providerSelection.selectedProvider).toBe('deepseek');

    cleanup();
  });

  test('keeps a custom selection while providers are still hydrating', () => {
    const { deps, customProviders } = createDeps();

    customProviders.state.hydrated = false;

    const { controller, cleanup } = createController(deps);

    deps.providerSelection.selectedProvider = 'custom-pending';
    flushSync();

    expect(controller.effectiveProvider).toBe('custom-pending');
    expect(deps.providerSelection.selectedProvider).toBe('custom-pending');

    customProviders.state.hydrated = true;
    flushSync();

    expect(controller.effectiveProvider).toBe('deepseek');
    expect(deps.providerSelection.selectedProvider).toBe('deepseek');

    cleanup();
  });

  test('snaps to DeepSeek when the selected provider disappears from the loaded catalog', () => {
    const { deps, customProviders } = createDeps();

    const provider = CustomProviderConfig.create({
      id: 'custom-deepseek',
      name: 'Old DeepSeek',
      baseURL: 'https://api.deepseek.com',
    });

    if (!provider.success) throw new Error('Invalid test provider');
    customProviders.state.providers = [provider.data];

    const { controller, cleanup } = createController(deps);

    deps.providerSelection.selectedProvider = 'custom-deepseek';
    flushSync();
    expect(controller.effectiveProvider).toBe('custom-deepseek');

    customProviders.state.providers = [];
    flushSync();

    expect(controller.effectiveProvider).toBe('deepseek');
    expect(deps.providerSelection.selectedProvider).toBe('deepseek');

    cleanup();
  });

  test('keeps another selected provider when an active custom provider is gone', () => {
    const { deps } = createDeps();

    deps.auth.state.credentials = makeCredentials(
      [makeCredential('custom-gone', 'orphan')],
      'orphan',
    );

    const { controller, cleanup } = createController(deps);

    deps.providerSelection.selectedProvider = 'groq';
    flushSync();

    expect(controller.effectiveProvider).toBe('groq');
    expect(deps.providerSelection.selectedProvider).toBe('groq');

    cleanup();
  });

  test('provides display options from the effective provider catalog', () => {
    const { deps, models } = createDeps();

    models.modelsFor.mockReturnValue([
      { id: 'model-v1', name: 'Friendly model', source: 'manual' },
    ]);

    const { controller, cleanup } = createController(deps);

    expect(controller.modelOptions).toEqual([
      { value: 'model-v1', label: 'Friendly model (model-v1)' },
    ]);

    cleanup();
  });

  test('starts capture and closes the popup after the request succeeds', async () => {
    const { deps } = createDeps();
    const { controller, cleanup } = createController(deps);

    await controller.startTranslation();

    expect(deps.startCapture).toHaveBeenCalledOnce();

    expect(deps.closePopup).toHaveBeenCalledOnce();
    cleanup();
  });

  test('keeps the popup open and reports a capture request failure', async () => {
    const { deps, toast } = createDeps();

    vi.mocked(deps.startCapture).mockRejectedValueOnce(
      new Error('unavailable'),
    );

    const { controller, cleanup } = createController(deps);

    await controller.startTranslation();
    expect(deps.closePopup).not.toHaveBeenCalled();

    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Could not start translation',
      }),
    );

    cleanup();
  });

  test('opens shortcut settings without starting translation', async () => {
    const { deps } = createDeps();
    const { controller, cleanup } = createController(deps);

    await controller.openShortcutSettings();
    expect(deps.openShortcutSettings).toHaveBeenCalledOnce();
    expect(deps.startCapture).not.toHaveBeenCalled();

    expect(controller.shortcutSettingsUrl).toBe(
      'chrome://extensions/shortcuts',
    );

    cleanup();
  });

  test('reports a shortcut navigation failure with the manual destination', async () => {
    const { deps, toast } = createDeps();

    vi.mocked(deps.openShortcutSettings).mockRejectedValueOnce(
      new Error('blocked'),
    );

    const { controller, cleanup } = createController(deps);

    await controller.openShortcutSettings();

    expect(toast.show).toHaveBeenCalledWith({
      type: 'error',
      message: 'Could not open shortcut settings',
      description:
        'Open chrome://extensions/shortcuts to configure the translation shortcut.',
    });

    cleanup();
  });

  test('owns one provider switch at a time and suspends automatic key reconciliation', async () => {
    let finish!: (error: string | null) => void;
    const { deps, auth } = createDeps();

    auth.setActiveKey.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    const { controller, cleanup } = createController(deps);

    const switching = controller.changeProvider('groq');

    flushSync();
    expect(controller.changingProvider).toBe(true);
    expect(controller.canTranslate).toBe(false);
    expect(auth.setActiveKey).toHaveBeenCalledTimes(1);

    await controller.changeProvider('deepseek');
    expect(deps.providerSelection.selectedProvider).toBe('groq');
    expect(auth.setActiveKey).toHaveBeenCalledTimes(1);

    finish('Could not save');
    await switching;
    expect(controller.changingProvider).toBe(false);
    expect(controller.effectiveProvider).toBe('google');
    cleanup();
  });

  test('recovers a rejected provider write and releases the switch guard', async () => {
    const { deps, auth, toast } = createDeps();

    auth.setActiveKey.mockRejectedValueOnce(new Error('storage closed'));

    const { controller, cleanup } = createController(deps);

    await controller.changeProvider('groq');
    expect(controller.changingProvider).toBe(false);
    expect(controller.effectiveProvider).toBe('google');

    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Could not switch provider' }),
    );

    cleanup();
  });
});
