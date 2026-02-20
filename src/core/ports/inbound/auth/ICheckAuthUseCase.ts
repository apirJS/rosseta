import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';

export interface ICheckAuthUseCase {
  execute(): Promise<Result<boolean, AppError>>;
}
