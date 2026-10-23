import type { IProviderMutationLock } from '../../../../core/ports/outbound/IProviderMutationLock';
import { StorageError, type AppError } from '../../../../shared/errors';
import { failure, type Result } from '../../../../shared/types/Result';

// One queue per provider across all adapter instances in this realm. Web Locks
// additionally coordinate operations in the popup and background contexts.
const pendingProviderWork = new Map<string, Promise<void>>();

export class BrowserProviderMutationLock implements IProviderMutationLock {
  run<T>(
    provider: string,
    work: () => Promise<Result<T, AppError>>,
  ): Promise<Result<T, AppError>> {
    const previous = pendingProviderWork.get(provider) ?? Promise.resolve();

    const operation = previous.then(() =>
      this.runWithBrowserLock(provider, work),
    );

    const settled = operation.then(
      () => undefined,
      () => undefined,
    );

    pendingProviderWork.set(provider, settled);

    void settled.then(() => {
      if (pendingProviderWork.get(provider) === settled) {
        pendingProviderWork.delete(provider);
      }
    });

    return operation;
  }

  private async runWithBrowserLock<T>(
    provider: string,
    work: () => Promise<Result<T, AppError>>,
  ): Promise<Result<T, AppError>> {
    const lockName = `rosseta:provider-mutation:${provider}`;
    let started = false;

    const protectedWork = () => {
      started = true;

      return work();
    };

    try {
      const locks =
        typeof navigator === 'undefined' ? undefined : navigator.locks;

      return locks
        ? await locks.request(lockName, { mode: 'exclusive' }, protectedWork)
        : await protectedWork();
    } catch (error) {
      // Work failures belong to the caller. A failure to acquire the lock must
      // never fall back to an unprotected mutation.
      if (started) throw error;

      return failure(
        StorageError.writeFailed(
          lockName,
          error instanceof Error ? error : new Error(String(error)),
        ),
      );
    }
  }
}
