import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';

export interface ModelInfo {
  id: string;
  name: string;
}

export interface IModelFetchService {
  canFetch(provider: string): boolean;
  fetchModels(
    provider: string,
    apiKey: string,
    baseURL?: string,
    headers?: Record<string, string>,
    queryParams?: Record<string, string>,
  ): Promise<Result<ModelInfo[], AppError>>;
}
