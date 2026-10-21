/** Suppress stale reads and callbacks after their owning popup has been disposed. */
export function createHydrationLifetime() {
  let revision = 0;
  let disposed = false;

  return {
    begin: () => ++revision,
    isCurrent: (read: number) => !disposed && read === revision,
    get disposed() {
      return disposed;
    },
    dispose() {
      disposed = true;
      revision++;
    },
  };
}
