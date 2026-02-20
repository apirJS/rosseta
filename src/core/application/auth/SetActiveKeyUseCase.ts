import type { ISetActiveKeyUseCase } from '../../ports/inbound/auth/ISetActiveKeyUseCase';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import { success, failure, type Result } from '../../../shared/types/Result';
import { AuthError, type AppError } from '../../../shared/errors';
import type { Credentials } from '../../domain/credential/Credentials';

export class SetActiveKeyUseCase implements ISetActiveKeyUseCase {
  constructor(private readonly credentialStorage: ICredentialStorage) {}

  async execute(credentialId: string): Promise<Result<Credentials, AppError>> {
    const storageResult = await this.credentialStorage.get();
    if (!storageResult.success) {
      return failure(storageResult.error);
    }

    const credentials = storageResult.data;
    if (!credentials) {
      return failure(AuthError.invalidApiKey('No credentials found'));
    }

    const setActiveResult = credentials.setActive(credentialId);
    if (!setActiveResult.success) {
      return failure(AuthError.invalidApiKey(setActiveResult.error.message));
    }

    const saveResult = await this.credentialStorage.save(setActiveResult.data);
    if (!saveResult.success) {
      return failure(saveResult.error);
    }

    return success(setActiveResult.data);
  }
}
