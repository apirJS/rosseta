import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { StoredModel } from '../../outbound/IModelStorage';

export interface IAddCustomModelUseCase {
  execute(
    provider: string,
    modelId: string,
    modelName?: string,
  ): Promise<Result<StoredModel[], AppError>>;
}
