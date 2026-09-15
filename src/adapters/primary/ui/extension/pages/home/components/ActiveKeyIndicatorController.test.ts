import { describe, expect, test, vi, beforeEach } from 'vitest';
import {
  createActiveKeyIndicatorController,
  type ActiveKeyIndicatorDeps,
} from './ActiveKeyIndicatorController.svelte';
import { maskApiKey } from '../../../../shared/utils';
import { KeySelectionMode } from '../../../../../../../core/domain/credential/KeySelectionMode';
import type { Credential } from '../../../../../../../core/domain/credential/Credential';
import type { Credentials } from '../../../../../../../core/domain/credential/Credentials';

function makeCredential(
  provider: string,
  id: string,
  keyValue: string,
): Credential {
  return {
    id,
    provider,
    apiKey: { value: keyValue },
  } as unknown as Credential;
}

function makeCredentials(items: Credential[]): Credentials {
  return {
    items,
    getActive: () => items[0] ?? null,
    getByProvider: (p: string) => items.filter((c) => c.provider === p),
  } as unknown as Credentials;
}

function createDeps(overrides: Partial<ActiveKeyIndicatorDeps> = {}) {
  const first = makeCredential('google', 'k1', 'sk-aaaaaaaaaaaaaaaa');
  const second = makeCredential('google', 'k2', 'sk-bbbbbbbbbbbbbbbb');

  const auth = {
    state: {
      credentials: makeCredentials([first, second]),
      keySelectionMode: KeySelectionMode.manual(),
    },
    setActiveKey: vi.fn().mockResolvedValue(null),
    setKeySelectionMode: vi.fn().mockResolvedValue(null),
  };

  const toast = { show: vi.fn() };

  const deps: ActiveKeyIndicatorDeps = {
    getProvider: () => 'google',
    getCredential: () => first,
    auth,
    toast,
    ...overrides,
  };

  return { deps, auth, toast, first, second };
}

describe('UI Controller: ActiveKeyIndicatorController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('lists the credentials that belong to the provider', () => {
    const { deps } = createDeps();
    const controller = createActiveKeyIndicatorController(deps);

    expect(controller.providerCredentials).toHaveLength(2);
    expect(controller.hasMultiple).toBe(true);
  });

  test('detects a single credential for the provider', () => {
    const { deps, first } = createDeps();
    deps.auth.state.credentials = makeCredentials([first]);
    const controller = createActiveKeyIndicatorController(deps);

    expect(controller.hasMultiple).toBe(false);
    expect(controller.autoBalanceProviders).toEqual([]);
  });

  test('offers auto-balance only with two or more keys', () => {
    const { deps } = createDeps();
    const controller = createActiveKeyIndicatorController(deps);

    expect(controller.autoBalanceProviders).toEqual(['google']);
  });

  test('the active credential is scoped to the provider', () => {
    const { deps, first } = createDeps();
    deps.getCredential = () =>
      makeCredential('groq', 'other', 'sk-cccccccccccccccc');
    const otherProvider = createActiveKeyIndicatorController(deps);

    expect(otherProvider.providerActive).toBeNull();
    expect(otherProvider.getTriggerLabel()).toBe('—');

    deps.getCredential = () => first;
    const sameProvider = createActiveKeyIndicatorController(deps);

    expect(sameProvider.providerActive).toBe(first);
    expect(sameProvider.getTriggerLabel()).toBe(
      maskApiKey('sk-aaaaaaaaaaaaaaaa'),
    );
  });

  test('the trigger label shows Auto when auto-balance targets the provider', () => {
    const { deps } = createDeps();
    deps.auth.state.keySelectionMode = KeySelectionMode.autoBalance('google');
    const controller = createActiveKeyIndicatorController(deps);

    expect(controller.getTriggerLabel()).toBe('Auto ⟳');
  });

  test('toggle and close manage the dropdown state', () => {
    const { deps } = createDeps();
    const controller = createActiveKeyIndicatorController(deps);

    expect(controller.state.isOpen).toBe(false);

    controller.toggle();
    expect(controller.state.isOpen).toBe(true);

    controller.close();
    expect(controller.state.isOpen).toBe(false);
  });

  test('selectKey switches to manual mode first when not manual', async () => {
    const { deps, auth, second } = createDeps();
    deps.auth.state.keySelectionMode = KeySelectionMode.autoBalance('google');
    const controller = createActiveKeyIndicatorController(deps);
    controller.toggle();

    await controller.selectKey(second);

    expect(auth.setKeySelectionMode).toHaveBeenCalledWith(
      KeySelectionMode.manual(),
    );
    expect(auth.setActiveKey).toHaveBeenCalledWith('k2');
    expect(controller.state.isOpen).toBe(false);
  });

  test('selectKey skips the mode switch when already manual', async () => {
    const { deps, auth, second } = createDeps();
    const controller = createActiveKeyIndicatorController(deps);

    await controller.selectKey(second);

    expect(auth.setKeySelectionMode).not.toHaveBeenCalled();
    expect(auth.setActiveKey).toHaveBeenCalledWith('k2');
  });

  test('selectAutoBalance updates the key selection mode', async () => {
    const { deps, auth } = createDeps();
    const controller = createActiveKeyIndicatorController(deps);
    controller.toggle();

    await controller.selectAutoBalance('google');

    expect(auth.setKeySelectionMode).toHaveBeenCalledWith(
      KeySelectionMode.autoBalance('google'),
    );
    expect(controller.state.isOpen).toBe(false);
  });

  test('selectAutoBalance toasts when the mode cannot be saved', async () => {
    const { deps, auth, toast } = createDeps();
    auth.setKeySelectionMode = vi.fn().mockResolvedValue('Mode broken');
    const controller = createActiveKeyIndicatorController(deps);

    await controller.selectAutoBalance('google');

    expect(toast.show).toHaveBeenCalledWith({
      type: 'error',
      message: 'Could not enable auto-balance',
      description: 'Mode broken',
    });
    expect(controller.state.isOpen).toBe(false);
  });
});
