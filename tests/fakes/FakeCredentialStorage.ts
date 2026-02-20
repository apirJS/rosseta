import { Credentials } from '../../src/core/domain/credential/Credentials';
import type { ICredentialStorage } from '../../src/core/ports/outbound/ICredentialStorage';
import { AppError } from '../../src/shared/errors';
import { failure, type Result, success } from '../../src/shared/types/Result';

export class FakeCredentialStorage implements ICredentialStorage {
  private _storage: Credentials | null = null;
  private _error: AppError | null = null;

  failNextCallWith(error: AppError): void {
    this._error = error;
  }

  cleanupError(): void {
    this._error = null;
  }

  /** Seed the fake with pre-existing credentials */
  seedWith(credentials: Credentials): void {
    this._storage = credentials;
  }

  async get(): Promise<Result<Credentials | null, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }

    return success(this._storage);
  }

  async save(credentials: Credentials): Promise<Result<void, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }

    this._storage = credentials;

    return success(undefined);
  }
}
