import type { IProviderMutationLock } from '../../src/core/ports/outbound/IProviderMutationLock';
import type { AppError } from '../../src/shared/errors';
import { failure, type Result } from '../../src/shared/types/Result';

/** Deterministic provider-scoped serialization for application concurrency fixtures. */
export class FakeProviderMutationLock implements IProviderMutationLock {
  private readonly pending = new Map<string, Promise<void>>();
  private nextFailure: AppError | undefined;

  failNext(error: AppError): void {
    this.nextFailure = error;
  }

  run<T>(
    provider: string,
    work: () => Promise<Result<T, AppError>>,
  ): Promise<Result<T, AppError>> {
    const run = () => {
      if (!this.nextFailure) return work();

      const error = this.nextFailure;

      this.nextFailure = undefined;

      return Promise.resolve(failure(error));
    };

    const operation = (this.pending.get(provider) ?? Promise.resolve()).then(
      run,
      run,
    );

    const settled = operation.then(
      () => undefined,
      () => undefined,
    );

    this.pending.set(provider, settled);

    void settled.then(() => {
      if (this.pending.get(provider) === settled) this.pending.delete(provider);
    });

    return operation;
  }
}
