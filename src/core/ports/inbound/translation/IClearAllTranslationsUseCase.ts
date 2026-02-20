import type { AppError } from '../../../../shared/errors';
import type { Result } from '../../../../shared/types/Result';

export interface IClearAllTranslationsUseCase {
  execute(): Promise<Result<void, AppError>>;
}
