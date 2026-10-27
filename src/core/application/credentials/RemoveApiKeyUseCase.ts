import type { IRemoveApiKeyUseCase } from '../../ports/inbound/credentials/IRemoveApiKeyUseCase';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import { success, type Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import { Credentials } from '../../domain/credential/Credentials';
import { v4 as uuidv4 } from 'uuid';

export class RemoveApiKeyUseCase implements IRemoveApiKeyUseCase {
  constructor(private readonly credentialStorage: ICredentialStorage) {}

  async execute(credentialId: string): Promise<Result<Credentials, AppError>> {
    return this.credentialStorage.update((current) =>
      success(
        (current ?? Credentials.createEmpty(uuidv4())).remove(credentialId),
      ),
    );
  }
}
