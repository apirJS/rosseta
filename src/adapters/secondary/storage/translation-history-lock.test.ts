import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { serializeHistoryStorage } from './translation-history-lock';

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
  let pending: Promise<void> = Promise.resolve();
  const request = mock(
    (_name: string, _options: LockOptions, work: () => Promise<unknown>) => {
      const operation = pending.then(work, work);
      pending = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
  );
  return { request };
}

describe('Adapter: translation history lock', () => {
  beforeEach(() => {
    installLocks(undefined);
  });

  afterEach(() => {
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  test('serializes complete operations when Web Locks are unavailable', async () => {
    const held = deferred();
    const started = deferred();
    const events: string[] = [];
    const first = serializeHistoryStorage(async () => {
      events.push('first started');
      started.resolve();
      await held.promise;
      events.push('first completed');
      return 1;
    });
    const second = serializeHistoryStorage(async () => {
      events.push('second started');
      return 2;
    });

    await started.promise;
    expect(events).toEqual(['first started']);
    held.resolve();
    expect(await Promise.all([first, second])).toEqual([1, 2]);
    expect(events).toEqual([
      'first started',
      'first completed',
      'second started',
    ]);
  });

  test('waits for work in another context holding the same browser lock', async () => {
    const locks = makeSharedLocks();
    installLocks(locks);
    const held = deferred();
    const started = deferred();
    const events: string[] = [];
    const externalWork = locks.request(
      'rosseta:translation-history',
      { mode: 'exclusive' },
      async () => {
        events.push('external started');
        started.resolve();
        await held.promise;
        events.push('external completed');
      },
    );
    const localWork = serializeHistoryStorage(async () => {
      events.push('local started');
      return 'saved';
    });

    await started.promise;
    expect(events).toEqual(['external started']);
    held.resolve();
    await externalWork;
    expect(await localWork).toBe('saved');
    expect(events).toEqual([
      'external started',
      'external completed',
      'local started',
    ]);
    expect(locks.request.mock.calls[1]?.slice(0, 2)).toEqual([
      'rosseta:translation-history',
      { mode: 'exclusive' },
    ]);
  });

  test('releases the queue after failed work without repeating the operation', async () => {
    installLocks(makeSharedLocks());
    const work = mock(async () => {
      throw new Error('write failed');
    });

    await expect(serializeHistoryStorage(work)).rejects.toThrow('write failed');
    expect(await serializeHistoryStorage(async () => 'next operation')).toBe(
      'next operation',
    );
    expect(work).toHaveBeenCalledTimes(1);
  });

  test('does not run storage work outside the lock when lock acquisition fails', async () => {
    installLocks({
      request: async () => {
        throw new Error('lock unavailable');
      },
    });
    const work = mock(async () => 'written');

    await expect(serializeHistoryStorage(work)).rejects.toThrow(
      'lock unavailable',
    );
    expect(work).not.toHaveBeenCalled();
    installLocks(undefined);
    expect(await serializeHistoryStorage(async () => 'next operation')).toBe(
      'next operation',
    );
  });
});
