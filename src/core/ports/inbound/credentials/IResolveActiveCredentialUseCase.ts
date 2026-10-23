import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { Credential } from '../../../domain/credential/Credential';
import type { Credentials } from '../../../domain/credential/Credentials';

export interface IResolveActiveCredentialUseCase {
  execute(credentials: Credentials): Promise<Result<Credential, AppError>>;
}
