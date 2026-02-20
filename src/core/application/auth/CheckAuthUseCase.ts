import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import { success, failure, type Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { ICheckAuthUseCase } from '../../ports/inbound/auth/ICheckAuthUseCase';

export class CheckAuthUseCase implements ICheckAuthUseCase {
  constructor(private readonly credentialStorage: ICredentialStorage) {}

  async execute(): Promise<Result<boolean, AppError>> {
    const result = await this.credentialStorage.get();
    if (!result.success) {
      return failure(result.error);
    }
    return success(result.data !== null);
  }
}
