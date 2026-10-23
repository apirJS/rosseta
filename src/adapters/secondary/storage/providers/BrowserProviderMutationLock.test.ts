import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { StorageError, ErrorCode } from '../../../../shared/errors';
import { failure, success } from '../../../../shared/types/Result';
import { BrowserProviderMutationLock } from './BrowserProviderMutationLock';

const navigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
);

function installLocks(locks: unknown): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { locks },
  });
}

function deferred() {
  let resolve!: () => void;

  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function makeSharedLocks() {
  const pending = new Map<string, Promise<void>>();

  const request = mock(
    (name: string, _options: LockOptions, work: () => Promise<unknown>) => {
      const operation = (pending.get(name) ?? Promise.resolve()).then(work);

      pending.set(
        name,
        operation.then(
          () => undefined,
          () => undefined,
        ),
      );

      return operation;
    },
  );

  return { request };
}

describe('Adapter: BrowserProviderMutationLock', () => {
  beforeEach(() => installLocks(undefined));

  afterEach(() => {
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  test('serializes the same provider across separate instances without Web Locks', async () => {
    const held = deferred();
    const started = deferred();
    const events: string[] = [];

    const first = new BrowserProviderMutationLock().run(
      'custom:first',
      async () => {
        events.push('first started');
        started.resolve();
        await held.promise;
        events.push('first completed');

        return success(1);
      },
    );

    const second = new BrowserProviderMutationLock().run(
      'custom:first',
      async () => {
        events.push('second started');

        return success(2);
      },
    );

    await started.promise;
    expect(events).toEqual(['first started']);
    held.resolve();

    expect(await Promise.all([first, second])).toEqual([
      success(1),
      success(2),
    ]);

    expect(events).toEqual([
      'first started',
      'first completed',
      'second started',
    ]);
  });

  test('allows different providers to proceed independently', async () => {
    const held = deferred();
    const started = deferred();
    const adapter = new BrowserProviderMutationLock();

    const first = adapter.run('custom:first', async () => {
      started.resolve();
      await held.promise;

      return success('first');
    });

    await started.promise;

    expect(
      await adapter.run('custom:second', async () => success('second')),
    ).toEqual(success('second'));

    held.resolve();
    await first;
  });

  test('uses the provider-specific native lock and waits for another context', async () => {
    const locks = makeSharedLocks();

    installLocks(locks);

    const held = deferred();
    const started = deferred();
    const events: string[] = [];

    const externalWork = locks.request(
      'rosseta:provider-mutation:custom:shared',
      { mode: 'exclusive' },
      async () => {
        events.push('external started');
        started.resolve();
        await held.promise;
        events.push('external completed');
      },
    );

    const localWork = new BrowserProviderMutationLock().run(
      'custom:shared',
      async () => {
        events.push('local started');

        return success('saved');
      },
    );

    await started.promise;
    expect(events).toEqual(['external started']);
    held.resolve();
    await externalWork;
    expect(await localWork).toEqual(success('saved'));

    expect(events).toEqual([
      'external started',
      'external completed',
      'local started',
    ]);

    expect(locks.request.mock.calls[1]?.slice(0, 2)).toEqual([
      'rosseta:provider-mutation:custom:shared',
      { mode: 'exclusive' },
    ]);
  });

  test.each([false, true])(
    'releases the queue after thrown work with native locks %s',
    async (native) => {
      if (native) installLocks(makeSharedLocks());

      const adapter = new BrowserProviderMutationLock();
      const error = new Error('mutation failed');

      const work = mock(async () => {
        throw error;
      });

      const failed = adapter.run('custom:failed', work);
      const next = adapter.run('custom:failed', async () => success('next'));

      await expect(failed).rejects.toBe(error);
      expect(await next).toEqual(success('next'));
      expect(work).toHaveBeenCalledTimes(1);
    },
  );

  test('returns acquisition failure without running work and releases the queue', async () => {
    const error = new Error('lock unavailable');

    installLocks({
      request: async () => {
        throw error;
      },
    });

    const adapter = new BrowserProviderMutationLock();
    const work = mock(async () => success('written'));

    const result = await adapter.run('custom:blocked', work);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
      expect(result.error.cause).toBe(error);

      expect(result.error.context).toEqual({
        key: 'rosseta:provider-mutation:custom:blocked',
      });
    }

    expect(work).not.toHaveBeenCalled();
    installLocks(undefined);

    expect(
      await adapter.run('custom:blocked', async () => success('next')),
    ).toEqual(success('next'));
  });

  test('preserves failed Results without wrapping or retrying work', async () => {
    installLocks(makeSharedLocks());

    const result = failure(StorageError.writeFailed('models:custom:failed'));
    const work = mock(async () => result);

    expect(
      await new BrowserProviderMutationLock().run('custom:failed-result', work),
    ).toBe(result);

    expect(work).toHaveBeenCalledTimes(1);
  });
});
