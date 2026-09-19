import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';

export interface StoredModel {
  id: string;
  name: string;
  source: 'fetched' | 'manual';
}

export interface IModelStorage {
  getModels(provider: string): Promise<Result<StoredModel[], AppError>>;
  getAllModels(): Promise<
    Result<Record<string, StoredModel[]>, AppError>
  >;
  setModels(
    provider: string,
    models: StoredModel[],
  ): Promise<Result<void, AppError>>;
  replaceAllModels(
    models: Record<string, StoredModel[]>,
  ): Promise<Result<void, AppError>>;
  clearModels(provider: string): Promise<Result<void, AppError>>;
}
