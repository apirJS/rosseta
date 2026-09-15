import type { IUserPreferencesStorage } from '../../src/core/ports/outbound/IUserPreferencesStorage';
import {
  UserPreferences,
  type UserPreferencesProps,
} from '../../src/core/domain/preferences/UserPreferences';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';
import { v4 as uuidv4 } from 'uuid';

export class FakeUserPreferencesStorage implements IUserPreferencesStorage {
  private _storage: UserPreferences | null = null;
  private _error: AppError | null = null;
  private _setError: AppError | null = null;
  private _setCalls: Partial<UserPreferencesProps>[] = [];

  /** Seed the fake with pre-existing preferences */
  seed(preferences: UserPreferences): void {
    this._storage = preferences;
  }

  /** Make the next call fail once with the given error */
  failNextCallWith(error: AppError): void {
    this._error = error;
  }

  /** Make the next set() call fail once with the given error */
  failNextSetWith(error: AppError): void {
    this._setError = error;
  }

  get stored(): UserPreferences | null {
    return this._storage;
  }

  /** Every partial payload passed to set(), in call order */
  get setCalls(): readonly Partial<UserPreferencesProps>[] {
    return this._setCalls;
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
    preferences: Partial<UserPreferencesProps>,
  ): Promise<Result<void, AppError>> {
    if (this._setError) {
      const error = this._setError;
      this._setError = null;
      return failure(error);
    }

    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }

    this._setCalls.push(preferences);

    const base: UserPreferencesProps =
      this._storage?.toProps() ??
      UserPreferences.createDefault(uuidv4()).toProps();
    const merged = { ...base, ...preferences };
    const result = UserPreferences.fromRaw({
      id: merged.id,
      theme: merged.theme,
      targetLanguage: merged.targetLanguage,
      selectedModels: merged.selectedModels,
      includeDescription: merged.includeDescription,
    });
    if (result.success) {
      this._storage = result.data;
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
