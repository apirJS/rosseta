import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { StoredModel } from '../../outbound/IModelStorage';
import type { CustomProviderType } from '../../../domain/provider/CustomProviderConfig';

export interface IFetchModelsUseCase {
  execute(
    provider: string,
    apiKey: string,
    baseURL?: string,
    headers?: Record<string, string>,
    queryParams?: Record<string, string>,
    customProviderType?: CustomProviderType,
  ): Promise<Result<StoredModel[], AppError>>;
}
