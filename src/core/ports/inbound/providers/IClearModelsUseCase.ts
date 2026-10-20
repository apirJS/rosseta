import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';

export interface IClearModelsUseCase {
  execute(provider: string): Promise<Result<void, AppError>>;
}
