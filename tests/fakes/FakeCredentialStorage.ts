import { Credentials } from '../../src/core/domain/credential/Credentials';
import type { ICredentialStorage } from '../../src/core/ports/outbound/ICredentialStorage';
import { AppError } from '../../src/shared/errors';
import { failure, type Result, success } from '../../src/shared/types/Result';

export class FakeCredentialStorage implements ICredentialStorage {
  private storageValue: Credentials | null = null;
  private injectedError: AppError | null = null;

  failNextCallWith(error: AppError): void {
    this.injectedError = error;
  }

  cleanupError(): void {
    this.injectedError = null;
  }

  /** Seed the fake with pre-existing credentials */
  seedWith(credentials: Credentials): void {
    this.storageValue = credentials;
  }

  async get(): Promise<Result<Credentials | null, AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }

    return success(this.storageValue);
  }

  async save(credentials: Credentials): Promise<Result<void, AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }

    this.storageValue = credentials;

    return success(undefined);
  }
}
