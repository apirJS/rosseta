import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';

/** Coordinates a provider's complete read-modify-write operation. */
export interface IProviderMutationLock {
  run<T>(
    provider: string,
    work: () => Promise<Result<T, AppError>>,
  ): Promise<Result<T, AppError>>;
}
