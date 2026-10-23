import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { StoredModel } from '../../outbound/IModelStorage';

export interface IRefreshProviderModelsUseCase {
  execute(provider: string): Promise<Result<StoredModel[], AppError>>;
}
