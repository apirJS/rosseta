import type { Provider } from '../../domain/credential/Provider';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export interface IApiKeyValidator {
  validate(apiKey: string, provider: Provider): Promise<Result<void, AppError>>;
}
