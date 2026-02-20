import type { Credentials } from '../../../domain/credential/Credentials';
import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';

export interface IRemoveApiKeyUseCase {
  execute(credentialId: string): Promise<Result<Credentials, AppError>>;
}
