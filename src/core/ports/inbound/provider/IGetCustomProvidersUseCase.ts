import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { CustomProviderConfig } from '../../../domain/provider/CustomProviderConfig';

export interface IGetCustomProvidersUseCase {
  execute(): Promise<Result<CustomProviderConfig[], AppError>>;
}
