import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';
import type { CustomProviderConfig } from '../../domain/provider/CustomProviderConfig';

export interface ICustomProviderStorage {
  load(): Promise<Result<CustomProviderConfig[], AppError>>;
  save(config: CustomProviderConfig): Promise<Result<void, AppError>>;
  replaceAll(
    configs: CustomProviderConfig[],
  ): Promise<Result<void, AppError>>;
  remove(id: string): Promise<Result<void, AppError>>;
}
