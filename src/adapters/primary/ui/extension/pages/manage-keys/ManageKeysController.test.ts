import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  createManageKeysController,
  type ManageKeysDeps,
} from './ManageKeysController.svelte';
import { ApiKey } from '../../../../../../core/domain/credential/ApiKey';
import { Credential } from '../../../../../../core/domain/credential/Credential';
import { Credentials } from '../../../../../../core/domain/credential/Credentials';
import { KeySelectionMode } from '../../../../../../core/domain/credential/KeySelectionMode';
import type { StoredModel } from '../../../../../../core/ports/outbound/IModelStorage';
import { success } from '../../../../../../shared/types/Result';
import type { PopupToastController } from '../../../shared/toast/PopupToastController.svelte';

function makeCredential(id: string, rawKey: string, provider: 'google' | 'groq') {
  const apiKey = ApiKey.createWithProvider(rawKey, provider);
  if (!apiKey.success) throw new Error('bad key');
  const cred = Credential.create(id, apiKey.data, provider);
  if (!cred.success) throw new Error('bad cred');
  return cred.data;
}

function createToastFake() {
  const show = vi.fn();
  const toast = {
    show,
    dismiss: vi.fn(),
    update: vi.fn(),
    toasts: [],
  } as unknown as PopupToastController;
  return { toast, show };
}

function createDeps(overrides: Partial<ManageKeysDeps> = {}) {
  const { toast, show } = createToastFake();

  const credentials = Credentials.createEmpty('creds-1')
    .add(makeCredential('g1', 'AIzaGoogleKeyValue123', 'google'))
    .add(makeCredential('q1', 'gsk_groqKeyValue123', 'groq'));

  const deps: ManageKeysDeps = {
    credentials: () => credentials,
    addApiKey: vi.fn().mockResolvedValue(null),
    removeApiKey: vi.fn().mockResolvedValue(null),
    setActiveKey: vi.fn().mockResolvedValue(null),
    currentKeySelectionMode: () => KeySelectionMode.manual(),
    setKeySelectionMode: vi.fn().mockResolvedValue(null),
    modelsFor: vi.fn().mockReturnValue([]),
    fetchModels: vi.fn().mockResolvedValue(
      success<StoredModel[]>([
        { id: 'm1', name: 'Model 1', source: 'fetched' },
      ]),
    ),
    clearAllModels: vi.fn().mockResolvedValue(undefined),
    toast,
    ...overrides,
  };

  return { deps, show, credentials };
}

function flush(): Promise<unknown> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('UI Controller: ManageKeysController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('lists only keys for the selected provider', () => {
    const { deps } = createDeps();
    const controller = createManageKeysController(deps);

    expect(controller.allKeys).toHaveLength(2);
    expect(controller.providerKeys.map((c) => c.id)).toEqual(['g1']);
    expect(controller.visibleKeys.map((c) => c.id)).toEqual(['g1']);

    controller.setProvider('groq');
    expect(controller.providerKeys.map((c) => c.id)).toEqual(['q1']);
    expect(controller.visibleKeys.map((c) => c.id)).toEqual(['q1']);
  });

  test('setProvider resets the key input', () => {
    const { deps } = createDeps();
    const controller = createManageKeysController(deps);
    controller.state.keyInput = 'pending-key';

    controller.setProvider('groq');

    expect(controller.state.selectedProvider).toBe('groq');
    expect(controller.state.keyInput).toBe('');
  });

  test('addApiKey with empty input does nothing', async () => {
    const { deps } = createDeps();
    const controller = createManageKeysController(deps);

    await controller.addApiKey();

    expect(deps.addApiKey).not.toHaveBeenCalled();
  });

  test('addApiKey duplicate shows an error toast', async () => {
    const { deps, show } = createDeps();
    const controller = createManageKeysController(deps);
    controller.state.keyInput = 'AIzaGoogleKeyValue123';

    await controller.addApiKey();

    expect(deps.addApiKey).not.toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: 'Key already added' }),
    );
  });

  test('addApiKey success clears the input and toasts', async () => {
    const { deps, show } = createDeps();
    const controller = createManageKeysController(deps);
    controller.state.selectedProvider = 'groq';
    controller.state.keyInput = 'gsk_new_key_value';

    await controller.addApiKey();

    expect(deps.addApiKey).toHaveBeenCalledWith('gsk_new_key_value', 'groq');
    expect(controller.state.keyInput).toBe('');
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', message: 'API key added' }),
    );
  });

  test('addApiKey failure shows an error toast and keeps input', async () => {
    const { deps, show } = createDeps({
      addApiKey: vi.fn().mockResolvedValue('Storage is full'),
    });
    const controller = createManageKeysController(deps);
    controller.state.keyInput = 'gsk_new_key_value';

    await controller.addApiKey();

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Could not add key',
        description: 'Storage is full',
      }),
    );
    expect(controller.state.keyInput).toBe('gsk_new_key_value');
  });

  test('addApiKey auto-fetches models when the provider has none stored', async () => {
    const { deps } = createDeps();
    const controller = createManageKeysController(deps);
    controller.state.selectedProvider = 'groq';
    controller.state.keyInput = 'gsk_new_key_value';

    await controller.addApiKey();

    expect(deps.fetchModels).toHaveBeenCalledWith('groq');
  });

  test('addApiKey skips auto-fetch when models are already stored', async () => {
    const { deps } = createDeps({
      modelsFor: vi.fn().mockReturnValue([
        { id: 'm1', name: 'Model 1', source: 'fetched' },
      ]),
    });
    const controller = createManageKeysController(deps);
    controller.state.keyInput = 'gsk_new_key_value';

    await controller.addApiKey();

    expect(deps.fetchModels).not.toHaveBeenCalled();
  });

  test('search filters keys by key value within the selected provider', () => {
    const { deps } = createDeps();
    const controller = createManageKeysController(deps);

    controller.state.keyInput = 'aizaGoogle';
    expect(controller.visibleKeys.map((c) => c.id)).toEqual(['g1']);

    controller.state.keyInput = 'gsk_groqKeyValue123';
    expect(controller.visibleKeys).toHaveLength(0);
  });

  test('canAddKey is false for empty input and exact existing keys', () => {
    const { deps } = createDeps();
    const controller = createManageKeysController(deps);

    expect(controller.canAddKey).toBe(false);

    controller.state.keyInput = 'gsk_brand_new_key';
    expect(controller.canAddKey).toBe(true);

    controller.state.keyInput = 'AIzaGoogleKeyValue123';
    expect(controller.canAddKey).toBe(false);
  });

  describe('delete with undo', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('requestDelete hides the key immediately and commits after the window', async () => {
      const { deps } = createDeps();
      const controller = createManageKeysController(deps);

      controller.requestDelete('g1');

      expect(controller.state.pendingDeleteId).toBe('g1');
      expect(controller.visibleKeys).toHaveLength(0);
      expect(deps.removeApiKey).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      await vi.runAllTicks();

      expect(deps.removeApiKey).toHaveBeenCalledWith('g1');
      expect(controller.state.pendingDeleteId).toBeNull();
    });

    test('undo cancels the pending delete', async () => {
      const { deps } = createDeps();
      const controller = createManageKeysController(deps);

      controller.requestDelete('g1');
      controller.cancelPendingDelete();

      vi.advanceTimersByTime(6000);
      await vi.runAllTicks();

      expect(deps.removeApiKey).not.toHaveBeenCalled();
      expect(controller.visibleKeys.map((c) => c.id)).toEqual(['g1']);
    });

    test('requestDelete while pending cancels the previous timer', async () => {
      const { deps } = createDeps();
      const controller = createManageKeysController(deps);

      controller.requestDelete('g1');
      controller.requestDelete('q1');

      vi.advanceTimersByTime(5000);
      await vi.runAllTicks();

      expect(deps.removeApiKey).not.toHaveBeenCalledWith('g1');
      expect(deps.removeApiKey).toHaveBeenCalledWith('q1');
    });

    test('destroy commits the pending delete', async () => {
      const { deps } = createDeps();
      const controller = createManageKeysController(deps);

      controller.requestDelete('g1');
      controller.destroy();

      await vi.runAllTicks();

      expect(deps.removeApiKey).toHaveBeenCalledWith('g1');
    });

    test('deleting the last key clears all stored models', async () => {
      let live = Credentials.createEmpty('creds-1').add(
        makeCredential('g1', 'AIzaGoogleKeyValue123', 'google'),
      );
      const { deps } = createDeps({
        credentials: () => live,
        removeApiKey: vi.fn().mockImplementation(async () => {
          live = Credentials.createEmpty('creds-1');
          return null;
        }),
      });
      const controller = createManageKeysController(deps);

      controller.requestDelete('g1');
      await vi.advanceTimersByTimeAsync(5000);

      expect(deps.clearAllModels).toHaveBeenCalledTimes(1);
    });

    test('deleting a key while others remain keeps stored models', async () => {
      const { deps } = createDeps();
      const controller = createManageKeysController(deps);

      controller.requestDelete('g1');
      vi.advanceTimersByTime(5000);
      await vi.runAllTicks();

      expect(deps.clearAllModels).not.toHaveBeenCalled();
    });
  });

  test('viewKey exposes the full key value', () => {
    const { deps } = createDeps();
    const controller = createManageKeysController(deps);

    controller.viewKey('g1');
    expect(controller.viewingKey).toBe('AIzaGoogleKeyValue123');

    controller.closeViewer();
    expect(controller.viewingKey).toBeNull();
  });

  describe('setActiveKey', () => {
    test('drops out of auto-balance before activating the chosen key', async () => {
      const { deps } = createDeps({
        currentKeySelectionMode: () => KeySelectionMode.autoBalance('groq'),
      });
      const controller = createManageKeysController(deps);

      controller.setActiveKey(
        makeCredential('q1', 'gsk_groqKeyValue123', 'groq'),
      );
      await flush();

      expect(deps.setKeySelectionMode).toHaveBeenCalledWith(
        KeySelectionMode.manual(),
      );
      expect(deps.setActiveKey).toHaveBeenCalledWith('q1');
    });

    test('keeps manual mode untouched', async () => {
      const { deps } = createDeps();
      const controller = createManageKeysController(deps);

      controller.setActiveKey(
        makeCredential('g1', 'AIzaGoogleKeyValue123', 'google'),
      );
      await flush();

      expect(deps.setKeySelectionMode).not.toHaveBeenCalled();
      expect(deps.setActiveKey).toHaveBeenCalledWith('g1');
    });

    test('does not activate the key when leaving auto-balance fails', async () => {
      const { deps, show } = createDeps({
        currentKeySelectionMode: () => KeySelectionMode.autoBalance('groq'),
        setKeySelectionMode: vi.fn().mockResolvedValue('Storage is full'),
      });
      const controller = createManageKeysController(deps);

      controller.setActiveKey(
        makeCredential('q1', 'gsk_groqKeyValue123', 'groq'),
      );
      await flush();

      expect(deps.setActiveKey).not.toHaveBeenCalled();
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Could not switch to manual key selection',
        }),
      );
    });

    test('surfaces an activation failure', async () => {
      const { deps, show } = createDeps({
        setActiveKey: vi.fn().mockResolvedValue('Credential not found'),
      });
      const controller = createManageKeysController(deps);

      controller.setActiveKey(
        makeCredential('g1', 'AIzaGoogleKeyValue123', 'google'),
      );
      await flush();

      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Could not switch API key',
        }),
      );
    });
  });
});
