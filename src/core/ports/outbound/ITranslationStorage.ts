import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';
import type { Translation } from '../../domain/translation/Translation';

export interface ITranslationStorage {
  save(translation: Translation): Promise<Result<void, AppError>>;
  getById(id: string): Promise<Result<Translation | null, AppError>>;
  getAll(): Promise<Result<Translation[], AppError>>;
  delete(id: string): Promise<Result<void, AppError>>;
  clear(): Promise<Result<void, AppError>>;
}
