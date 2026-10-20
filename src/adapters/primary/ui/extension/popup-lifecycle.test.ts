import { describe, expect, test, vi } from 'vitest';
import { createPopupLifecycle } from './popup-lifecycle.svelte';
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
    dispose: vi.fn(),
  };
}

describe('UI: popup lifecycle', () => {
  test('starts independent reads once and waits for provider identities before catalogs', async () => {
    const custom = deferred();

    const deps = {
      auth: participant(),
      preferences: participant(),
      customProviders: participant(),
      models: participant(),
      disposeFeedback: vi.fn(),
    };

    deps.customProviders.hydrate.mockReturnValue(custom.promise);

    const lifecycle = createPopupLifecycle(deps);

    expect(deps.auth.hydrate).not.toHaveBeenCalled();

    const pending = lifecycle.initialize();

    expect(lifecycle.initialize()).toBe(pending);
    expect(deps.auth.hydrate).toHaveBeenCalledOnce();
    expect(deps.preferences.hydrate).toHaveBeenCalledOnce();
    expect(deps.models.hydrate).not.toHaveBeenCalled();
    custom.resolve(success(undefined));
    await pending;
    expect(deps.models.hydrate).toHaveBeenCalledOnce();
    expect(lifecycle.state.initialized).toBe(true);
    expect(lifecycle.state.failures).toEqual([]);
  });

  test('exposes partial failure, handles a thrown adapter error, and permits retry', async () => {
    const deps = {
      auth: participant(),
      preferences: participant(),
      customProviders: participant(),
      models: participant(),
      disposeFeedback: vi.fn(),
    };

    deps.auth.hydrate.mockResolvedValueOnce(
      failure(StorageError.readFailed('credentials')),
    );

    deps.customProviders.hydrate.mockRejectedValueOnce(
      new Error('read failed'),
    );

    const lifecycle = createPopupLifecycle(deps);

    await lifecycle.initialize();

    expect(
      lifecycle.state.failures.map((entry) => entry.name).toSorted(),
    ).toEqual(['API keys', 'Custom providers']);

    expect(lifecycle.state.initialized).toBe(true);
    await lifecycle.initialize();
    expect(lifecycle.state.failures).toEqual([]);
  });

  test('disposes resources once and suppresses unfinished initialization after close', async () => {
    const custom = deferred();

    const deps = {
      auth: participant(),
      preferences: participant(),
      customProviders: participant(),
      models: participant(),
      disposeFeedback: vi.fn(),
    };

    deps.customProviders.hydrate.mockReturnValue(custom.promise);

    const lifecycle = createPopupLifecycle(deps);
    const pending = lifecycle.initialize();

    lifecycle.dispose();
    lifecycle.dispose();
    custom.resolve(success(undefined));
    await pending;
    expect(deps.models.hydrate).not.toHaveBeenCalled();
    expect(lifecycle.state.initialized).toBe(false);
    for (const entry of [
      deps.auth,
      deps.preferences,
      deps.customProviders,
      deps.models,
    ])
      expect(entry.dispose).toHaveBeenCalledOnce();
    expect(deps.disposeFeedback).toHaveBeenCalledOnce();
  });
});
