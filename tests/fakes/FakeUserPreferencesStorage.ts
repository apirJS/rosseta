import type { IUserPreferencesStorage } from '../../src/core/ports/outbound/IUserPreferencesStorage';
import {
  UserPreferences,
  type UserPreferencesProps,
} from '../../src/core/domain/preferences/UserPreferences';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';
import { v4 as uuidv4 } from 'uuid';

export class FakeUserPreferencesStorage implements IUserPreferencesStorage {
  private storageValue: UserPreferences | null = null;
  private injectedError: AppError | null = null;
  private setErrorValue: AppError | null = null;
  private setCallValues: Partial<UserPreferencesProps>[] = [];

  /** Seed the fake with pre-existing preferences */
  seed(preferences: UserPreferences): void {
    this.storageValue = preferences;
  }

  /** Make the next call fail once with the given error */
  failNextCallWith(error: AppError): void {
    this.injectedError = error;
  }

  /** Make the next set() call fail once with the given error */
  failNextSetWith(error: AppError): void {
    this.setErrorValue = error;
  }

  get stored(): UserPreferences | null {
    return this.storageValue;
  }

  /** Every partial payload passed to set(), in call order */
  get setCalls(): readonly Partial<UserPreferencesProps>[] {
    return this.setCallValues;
  }

  async get(): Promise<Result<UserPreferences | null, AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }
    return success(this.storageValue);
  }

  async set(
    preferences: Partial<UserPreferencesProps>,
  ): Promise<Result<void, AppError>> {
    if (this.setErrorValue) {
      const error = this.setErrorValue;
      this.setErrorValue = null;
      return failure(error);
    }

    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }

    this.setCallValues.push(preferences);

    const base: UserPreferencesProps =
      this.storageValue?.toProps() ??
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
      this.storageValue = result.data;
    }
    return success(undefined);
  }

  async clear(): Promise<Result<void, AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }
    this.storageValue = null;
    return success(undefined);
  }
}
