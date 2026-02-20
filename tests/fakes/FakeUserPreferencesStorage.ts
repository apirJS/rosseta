import type { IUserPreferencesStorage } from '../../src/core/ports/outbound/IUserPreferencesStorage';
import type {
  UserPreferences,
  UserPreferencesProps,
} from '../../src/core/domain/preferences/UserPreferences';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';

export class FakeUserPreferencesStorage implements IUserPreferencesStorage {
  private _storage: UserPreferences | null = null;
  private _error: AppError | null = null;

  /** Seed the fake with pre-existing preferences */
  seed(preferences: UserPreferences): void {
    this._storage = preferences;
  }

  /** Make the next call fail once with the given error */
  failNextCallWith(error: AppError): void {
    this._error = error;
  }

  get stored(): UserPreferences | null {
    return this._storage;
  }

  async get(): Promise<Result<UserPreferences | null, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }
    return success(this._storage);
  }

  async set(
    _preferences: Partial<UserPreferencesProps>,
  ): Promise<Result<void, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }
    return success(undefined);
  }

  async clear(): Promise<Result<void, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }
    this._storage = null;
    return success(undefined);
  }
}
