import { describe, expect, test, vi, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import {
  createMainPageController,
  type MainPageDeps,
} from './MainPageController.svelte';
import { KeySelectionMode } from '../../../../../../core/domain/credential/KeySelectionMode';
import { ProviderRegistry } from '../../../../../../core/domain/provider/ProviderRegistry';
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

  const customProviders = {
    getProvider: vi.fn().mockReturnValue(null),
  };

  const toast = { show: vi.fn() };

  const deps: MainPageDeps = { auth, preferences, models, customProviders, toast };

  return { deps, auth, preferences, models, customProviders, toast };
}

function createController(deps: MainPageDeps) {
  let controller!: ReturnType<typeof createMainPageController>;
  const cleanup = $effect.root(() => {
    controller = createMainPageController(deps);
  });
  flushSync();
  return { controller, cleanup };
}

describe('UI Controller: MainPageController', () => {
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
    deps.auth.state.keySelectionMode = KeySelectionMode.autoBalance('groq');
    const { controller, cleanup } = createController(deps);

    expect(controller.effectiveProvider).toBe('groq');

    cleanup();
  });

  test('a user-selected provider overrides the active provider', () => {
    const { deps } = createDeps();
    const { controller, cleanup } = createController(deps);

    controller.state.selectedProvider = 'groq';
    expect(controller.effectiveProvider).toBe('groq');

    cleanup();
  });

  test('changeProvider selects the provider and activates its first key', async () => {
    const { deps, auth } = createDeps();
    const { controller, cleanup } = createController(deps);

    await controller.changeProvider('groq');

    expect(controller.state.selectedProvider).toBe('groq');
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

    expect(controller.state.selectedProvider).toBeNull();
    expect(auth.setActiveKey).not.toHaveBeenCalled();

    cleanup();
  });

  test('changeProvider keeps the selection when the provider has no keys', async () => {
    const { deps, auth } = createDeps();
    const { controller, cleanup } = createController(deps);

    await controller.changeProvider('xai');

    expect(controller.state.selectedProvider).toBe('xai');
    expect(auth.setActiveKey).not.toHaveBeenCalled();

    cleanup();
  });

  test('changeProvider reverts the selection and toasts when activation fails', async () => {
    const { deps, auth, toast } = createDeps();
    auth.setActiveKey = vi.fn().mockResolvedValue('Storage broken');
    const { controller, cleanup } = createController(deps);

    await controller.changeProvider('groq');

    expect(controller.state.selectedProvider).toBeNull();
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

    expect(controller.state.selectedProvider).toBeNull();
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
    models.modelsFor = vi.fn().mockReturnValue([makeModel('m1'), makeModel('m2')]);
    preferences.state.selectedModels = { google: 'm2' };
    const { controller, cleanup } = createController(deps);

    expect(controller.effectiveModelId).toBe('m2');

    cleanup();
  });

  test('effectiveModelId falls back to the provider default when saved is stale', () => {
    const { deps, models, preferences } = createDeps();
    const defaultId = ProviderRegistry.getDefaultModelId('google');
    models.modelsFor = vi.fn().mockReturnValue([makeModel(defaultId), makeModel('m1')]);
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

    expect(preferences.setSelectedModelFor).toHaveBeenCalledWith('google', 'm9');

    cleanup();
  });

  test('persists the effective model when it differs from the saved selection', () => {
    const { deps, models, preferences } = createDeps();
    models.modelsFor = vi.fn().mockReturnValue([makeModel('m1')]);
    const { controller, cleanup } = createController(deps);

    expect(preferences.setSelectedModelFor).toHaveBeenCalledWith('google', 'm1');

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
    const { controller, cleanup } = createController(deps);

    controller.state.selectedProvider = 'groq';
    flushSync();

    expect(auth.setActiveKey).toHaveBeenCalledWith('rk1');

    cleanup();
  });

  test('resets a selected custom provider that no longer exists', () => {
    const { deps } = createDeps();
    const { controller, cleanup } = createController(deps);

    controller.state.selectedProvider = 'custom-gone';
    flushSync();

    expect(controller.state.selectedProvider).toBeNull();

    cleanup();
  });
});
