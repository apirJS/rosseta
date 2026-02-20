import type { AppError } from '../../../../shared/errors';
import type { Result } from '../../../../shared/types/Result';
import type { Translation } from '../../../domain/translation/Translation';

export interface IGetTranslationUseCase {
  execute(id: string): Promise<Result<Translation | null, AppError>>;
}
