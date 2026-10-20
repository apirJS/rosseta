import type { AppError } from '../../../../shared/errors';
import type { Result } from '../../../../shared/types/Result';

export interface IDeleteTranslationUseCase {
  execute(id: string): Promise<Result<void, AppError>>;
}
