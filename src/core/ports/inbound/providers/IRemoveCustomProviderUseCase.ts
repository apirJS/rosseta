import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';

export interface IRemoveCustomProviderUseCase {
  execute(id: string): Promise<Result<void, AppError>>;
}
