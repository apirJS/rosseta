import { describe, expect, test, vi } from 'vitest';
import { createPopupInitializationController } from './PopupInitializationController.svelte';
import { success, failure, type Result } from '../../../../shared/types/Result';
import { StorageError, type AppError } from '../../../../shared/errors';

function deferred() {
  let resolve!: (result: Result<void, AppError>) => void;

  const promise = new Promise<Result<void, AppError>>((release) => {
    resolve = release;
  });

  return { promise, resolve };
}

function participant() {
  return {
    hydrate: vi.fn().mockResolvedValue(success(undefined)),
  };
}

describe('UI: popup initialization', () => {
  test('starts independent reads once and waits for provider identities before catalogs', async () => {
    const custom = deferred();

    const deps = {
      auth: participant(),
      preferences: participant(),
      customProviders: participant(),
      models: participant(),
    };

    deps.customProviders.hydrate.mockReturnValue(custom.promise);

    const controller = createPopupInitializationController(deps);

    expect(deps.auth.hydrate).not.toHaveBeenCalled();

    const pending = controller.initialize();

    expect(controller.initialize()).toBe(pending);
    expect(deps.auth.hydrate).toHaveBeenCalledOnce();
    expect(deps.preferences.hydrate).toHaveBeenCalledOnce();
    expect(deps.models.hydrate).not.toHaveBeenCalled();
    custom.resolve(success(undefined));
    await pending;
    expect(deps.models.hydrate).toHaveBeenCalledOnce();
    expect(controller.state.initialized).toBe(true);
    expect(controller.state.failures).toEqual([]);
  });

  test('exposes partial failure, handles a thrown adapter error, and permits retry', async () => {
    const deps = {
      auth: participant(),
      preferences: participant(),
      customProviders: participant(),
      models: participant(),
    };

    deps.auth.hydrate.mockResolvedValueOnce(
      failure(StorageError.readFailed('credentials')),
    );

    deps.customProviders.hydrate.mockRejectedValueOnce(
      new Error('read failed'),
    );

    const controller = createPopupInitializationController(deps);

    await controller.initialize();

    expect(
      controller.state.failures.map((entry) => entry.name).toSorted(),
    ).toEqual(['API keys', 'Custom providers']);

    expect(controller.state.initialized).toBe(true);
    await controller.initialize();
    expect(controller.state.failures).toEqual([]);
  });

  test('ignores unfinished initialization after unmount', async () => {
    const custom = deferred();

    const deps = {
      auth: participant(),
      preferences: participant(),
      customProviders: participant(),
      models: participant(),
    };

    deps.customProviders.hydrate.mockReturnValue(custom.promise);

    const controller = createPopupInitializationController(deps);
    const pending = controller.initialize();

    controller.dispose();
    controller.dispose();
    custom.resolve(success(undefined));
    await pending;
    expect(deps.models.hydrate).not.toHaveBeenCalled();
    expect(controller.state.initialized).toBe(false);
    await controller.initialize();
    expect(deps.auth.hydrate).toHaveBeenCalledOnce();
  });
});
