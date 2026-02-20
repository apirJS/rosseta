import type { IGetCredentialsUseCase } from '../../ports/inbound/auth/IGetCredentialUseCase';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import { type Result } from '../../../shared/types/Result';
import { type AppError } from '../../../shared/errors';
import type { Credentials } from '../../domain/credential/Credentials';

export class GetCredentialsUseCase implements IGetCredentialsUseCase {
  constructor(private readonly credentialStorage: ICredentialStorage) {}

  async execute(): Promise<Result<Credentials | null, AppError>> {
    return this.credentialStorage.get();
  }
}
