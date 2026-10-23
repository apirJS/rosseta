import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type {
  CustomProviderConfig,
  CustomProviderConfigProps,
} from '../../../domain/provider/CustomProviderConfig';

export interface ISaveCustomProviderUseCase {
  execute(
    props: CustomProviderConfigProps,
  ): Promise<Result<CustomProviderConfig, AppError>>;
}
