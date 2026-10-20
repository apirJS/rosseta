import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { StoredModel } from '../../outbound/IModelStorage';

export interface ILoadModelsUseCase {
  execute(provider: string): Promise<Result<StoredModel[], AppError>>;
  executeAll(): Promise<Result<Record<string, StoredModel[]>, AppError>>;
}
