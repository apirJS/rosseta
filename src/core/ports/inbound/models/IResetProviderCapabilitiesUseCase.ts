import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';

export interface IResetProviderCapabilitiesUseCase {
  execute(namespace: string): Promise<Result<void, AppError>>;
}
