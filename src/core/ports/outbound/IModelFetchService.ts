import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';
import type { CustomProviderType } from '../../domain/provider/CustomProviderConfig';

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
    customProviderType?: CustomProviderType,
  ): Promise<Result<ModelInfo[], AppError>>;
}
