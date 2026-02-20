import type { AppError } from '../../../../shared/errors';
import type { Result } from '../../../../shared/types/Result';
import type { Translation } from '../../../domain/translation/Translation';

export interface IGetAllTranslationsUseCase {
  execute(): Promise<Result<Translation[], AppError>>;
}
