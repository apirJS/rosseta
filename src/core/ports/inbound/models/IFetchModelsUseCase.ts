import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { StoredModel } from '../../outbound/IModelStorage';

export interface IFetchModelsUseCase {
  execute(
    provider: string,
    apiKey: string,
    baseURL?: string,
  ): Promise<Result<StoredModel[], AppError>>;
}
