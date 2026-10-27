import type { ISetActiveKeyUseCase } from '../../ports/inbound/credentials/ISetActiveKeyUseCase';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import { failure, type Result } from '../../../shared/types/Result';
import { AuthError, type AppError } from '../../../shared/errors';
import type { Credentials } from '../../domain/credential/Credentials';

export class SetActiveKeyUseCase implements ISetActiveKeyUseCase {
  constructor(private readonly credentialStorage: ICredentialStorage) {}

  async execute(credentialId: string): Promise<Result<Credentials, AppError>> {
    return this.credentialStorage.update((credentials) => {
      if (!credentials)
        return failure(AuthError.invalidApiKey('No credentials found'));

      const updated = credentials.setActive(credentialId);

      return updated.success
        ? updated
        : failure(AuthError.invalidApiKey(updated.error.message));
    });
  }
}
