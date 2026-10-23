const HISTORY_LOCK_NAME = 'rosseta:translation-history';

let pendingHistoryWork: Promise<void> = Promise.resolve();

// The queue covers instances in one realm. Web Locks also coordinate popup and
// background read-modify-write operations against their shared history key.
export function serializeHistoryStorage<T>(work: () => Promise<T>): Promise<T> {
  const run = (): Promise<T> => {
    const locks =
      typeof navigator === 'undefined' ? undefined : navigator.locks;

    return locks
      ? locks.request(HISTORY_LOCK_NAME, { mode: 'exclusive' }, work)
      : work();
  };

  const operation = pendingHistoryWork.then(run, run);

  pendingHistoryWork = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}
