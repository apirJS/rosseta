import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAuth } from './useAuth.svelte';
import { useModels } from './useModels.svelte';
import { usePreferences } from './usePreferences.svelte';
import { PopupToastController } from '../toast/PopupToastController.svelte';
import { Credentials } from '../../../../../core/domain/credential/Credentials';
import { KeySelectionMode } from '../../../../../core/domain/credential/KeySelectionMode';
import { UserPreferences } from '../../../../../core/domain/preferences/UserPreferences';
import { success } from '../../../../../shared/types/Result';
import type { StoredModel } from '../../../../../core/ports/outbound/IModelStorage';

const { getAuthContext, getModelsContext } = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  getModelsContext: vi.fn(),
}));

vi.mock('../context', () => ({ getAuthContext, getModelsContext }));

vi.mock('../../../../../shared/messaging', () => ({
  sendMessageToRuntime: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((release) => {
    resolve = release;
  });

  return { promise, resolve };
}

describe('UI: popup snapshot lifetimes', () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('auth construction is idle and disposed hydration cannot apply credentials', async () => {
    const getCredentials = vi
      .fn()
      .mockResolvedValue(success(Credentials.createEmpty('credentials')));

    getAuthContext.mockReturnValue({
      getCredentials: { execute: getCredentials },
      getKeySelectionMode: {
        execute: vi.fn().mockResolvedValue(success(KeySelectionMode.manual())),
      },
    });

    const auth = useAuth();

    expect(getCredentials).not.toHaveBeenCalled();

    const pending = auth.hydrate();

    auth.dispose();
    await pending;
    expect(auth.state.credentials).toBeNull();
    expect(auth.state.hydrated).toBe(false);
  });

  test('a stale catalog read cannot replace the newer popup snapshot', async () => {
    const first =
      deferred<ReturnType<typeof success<Record<string, StoredModel[]>>>>();

    const second =
      deferred<ReturnType<typeof success<Record<string, StoredModel[]>>>>();

    const load = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    getModelsContext.mockReturnValue({ loadModels: { executeAll: load } });

    const models = useModels();

    expect(load).not.toHaveBeenCalled();

    const oldRead = models.hydrate();
    const newRead = models.hydrate();

    second.resolve(
      success({ google: [{ id: 'fresh', name: 'Fresh', source: 'manual' }] }),
    );

    await newRead;

    first.resolve(
      success({ google: [{ id: 'stale', name: 'Stale', source: 'manual' }] }),
    );

    await oldRead;

    expect(models.modelsFor('google').map((model) => model.id)).toEqual([
      'fresh',
    ]);

    models.dispose();
  });

  test('a committed deletion still updates the cleanup snapshot after popup disposal', async () => {
    const initial = Credentials.fromProps({
      id: 'credentials',
      activeCredentialId: 'key',
      items: [
        {
          id: 'key',
          type: 'API_KEY',
          provider: 'google',
          apiKey: 'synthetic-key',
        },
      ],
    });

    if (!initial.success) throw initial.error;

    const removal = deferred<ReturnType<typeof success<Credentials>>>();

    getAuthContext.mockReturnValue({
      getCredentials: {
        execute: vi.fn().mockResolvedValue(success(initial.data)),
      },
      getKeySelectionMode: {
        execute: vi.fn().mockResolvedValue(success(KeySelectionMode.manual())),
      },
      removeApiKey: { execute: vi.fn().mockReturnValue(removal.promise) },
    });

    const auth = useAuth();

    await auth.hydrate();

    const pending = auth.removeApiKey('key');

    auth.dispose();
    removal.resolve(success(Credentials.createEmpty('credentials')));
    expect(await pending).toBeNull();
    expect(auth.state.credentials?.items).toEqual([]);
  });

  test('preferences attach one theme listener during explicit hydration and remove it on disposal', async () => {
    const add = vi.fn();
    const remove = vi.fn();

    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: add,
        removeEventListener: remove,
      })),
    );

    const getPreferences = vi
      .fn()
      .mockResolvedValue(success(UserPreferences.createDefault('preferences')));

    const applied = vi.fn();

    const preferences = usePreferences({
      getPreferences: { execute: getPreferences },
      updatePreferences: {
        execute: vi.fn().mockResolvedValue(success(undefined)),
      },
      getShortcut: { execute: vi.fn().mockResolvedValue(success(null)) },
      onThemeApplied: applied,
    });

    expect(getPreferences).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    await preferences.hydrate();
    await preferences.hydrate();
    expect(add).toHaveBeenCalledOnce();
    preferences.dispose();
    expect(remove).toHaveBeenCalledWith('change', add.mock.calls[0][1]);

    const count = applied.mock.calls.length;

    add.mock.calls[0][1]({ matches: true });
    expect(applied).toHaveBeenCalledTimes(count);
  });

  test('toast disposal releases both duration and dismissal timers', () => {
    vi.useFakeTimers();

    const feedback = new PopupToastController();

    feedback.show({ type: 'info', message: 'Timed' });

    const id = feedback.show({ type: 'loading', message: 'Dismissed' });

    feedback.dismiss(id);
    expect(vi.getTimerCount()).toBe(2);
    feedback.dispose();
    expect(vi.getTimerCount()).toBe(0);
    feedback.show({ type: 'info', message: 'Detached callback' });
    expect(feedback.toasts).toEqual([]);
  });
});
