import type { Credentials } from '../../../domain/credential/Credentials';
import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { ApiKey } from '../../../domain/credential/ApiKey';

export interface AddApiKeyCommand {
  readonly apiKey: ApiKey;
}

export interface IAddApiKeyUseCase {
  execute(command: AddApiKeyCommand): Promise<Result<Credentials, AppError>>;
}
