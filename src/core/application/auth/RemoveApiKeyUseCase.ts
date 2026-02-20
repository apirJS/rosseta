import type { IRemoveApiKeyUseCase } from '../../ports/inbound/auth/IRemoveApiKeyUseCase';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import { success, failure, type Result } from '../../../shared/types/Result';
import { AuthError, type AppError } from '../../../shared/errors';
import { Credentials } from '../../domain/credential/Credentials';
import { v4 as uuidv4 } from 'uuid';

export class RemoveApiKeyUseCase implements IRemoveApiKeyUseCase {
  constructor(private readonly credentialStorage: ICredentialStorage) {}

  async execute(credentialId: string): Promise<Result<Credentials, AppError>> {
    const storageResult = await this.credentialStorage.get();
    if (!storageResult.success) {
      return failure(storageResult.error);
    }

    const credentials = storageResult.data ?? Credentials.createEmpty(uuidv4());
    const updated = credentials.remove(credentialId);

    const saveResult = await this.credentialStorage.save(updated);
    if (!saveResult.success) {
      return failure(saveResult.error);
    }

    return success(updated);
  }
}
