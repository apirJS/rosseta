import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import puterSdk from '@heyputer/puter.js';
import { withPuterSession } from './PuterSdkSession';
import { ModelFetchService } from '../catalogs/ModelFetchService';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

const setToken = spyOn(puterSdk, 'setAuthToken').mockImplementation((token) => {
  puterSdk.authToken = token;
});

afterAll(() => setToken.mockRestore());

describe('Adapter: PuterSdkSession', () => {
  test('serializes different credentials for the entire underlying SDK operation', async () => {
    const entered = deferred<void>();
    const gate = deferred<void>();
    const tokens: string[] = [];

    const first = withPuterSession('credential-one', async (sdk) => {
      tokens.push(sdk.authToken!);
      entered.resolve();
      await gate.promise;
      tokens.push(sdk.authToken!);
    });

    await entered.promise;

    const second = withPuterSession('credential-two', async (sdk) => {
      tokens.push(sdk.authToken!);
    });

    await Promise.resolve();
    expect(tokens).toEqual(['credential-one']);
    gate.resolve();
    await Promise.all([first, second]);

    expect(tokens).toEqual([
      'credential-one',
      'credential-one',
      'credential-two',
    ]);
  });

  test('logical cancellation retains the credential lease until actual settlement', async () => {
    const entered = deferred<void>();
    const gate = deferred<void>();
    const controller = new AbortController();

    const first = withPuterSession(
      'cancelled-owner',
      async () => {
        entered.resolve();
        await gate.promise;
      },
      controller.signal,
    );

    await entered.promise;
    controller.abort(new Error('cancelled'));
    await expect(first).rejects.toThrow('cancelled');

    let nextEntered = false;

    const next = withPuterSession('next-owner', async () => {
      nextEntered = true;
    });

    await Promise.resolve();
    expect(nextEntered).toBe(false);
    expect(puterSdk.authToken).toBe('cancelled-owner');
    gate.resolve();
    await next;
    expect(nextEntered).toBe(true);
  });

  test('a cancelled waiter never changes the global token or acquires the lease', async () => {
    const entered = deferred<void>();
    const gate = deferred<void>();

    const owner = withPuterSession('owner', async () => {
      entered.resolve();
      await gate.promise;
    });

    await entered.promise;

    const controller = new AbortController();
    let invoked = false;

    const waiter = withPuterSession(
      'abandoned',
      async () => {
        invoked = true;
      },
      controller.signal,
    );

    controller.abort(new Error('cancel queue'));
    await expect(waiter).rejects.toThrow('cancel queue');
    expect(puterSdk.authToken).toBe('owner');
    gate.resolve();
    await owner;
    await withPuterSession('after-abandoned', async () => {});
    expect(invoked).toBe(false);
  });

  test('model fetching shares the translation lease around authentication and listModels', async () => {
    const entered = deferred<void>();
    const gate = deferred<void>();

    const getUser = spyOn(puterSdk.auth, 'getUser').mockResolvedValue(
      {} as never,
    );

    const listModels = spyOn(puterSdk.ai, 'listModels').mockResolvedValue([
      { id: 'vision', name: 'Vision', provider: 'fixture' },
    ] as never);

    try {
      const translation = withPuterSession('translation-token', async () => {
        entered.resolve();
        await gate.promise;
      });

      await entered.promise;

      const fetched = new ModelFetchService().fetchModels(
        'puter',
        'model-list-token',
      );

      await Promise.resolve();
      expect(getUser).not.toHaveBeenCalled();
      expect(puterSdk.authToken).toBe('translation-token');
      gate.resolve();
      await translation;

      const result = await fetched;

      expect(result.success).toBe(true);
      expect(getUser).toHaveBeenCalledTimes(1);
      expect(listModels).toHaveBeenCalledTimes(1);
      expect(puterSdk.authToken).toBe('model-list-token');
      if (result.success)
        expect(result.data[0]).toEqual({
          id: 'vision',
          name: 'Vision (fixture)',
        });
    } finally {
      getUser.mockRestore();
      listModels.mockRestore();
    }
  });
});
