import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';
import type {
  UserPreferences,
  UserPreferencesProps,
} from '../../domain/preferences/UserPreferences';

export interface IUserPreferencesStorage {
  get(): Promise<Result<UserPreferences | null, AppError>>;
  set(
    preferences: Partial<UserPreferencesProps>,
  ): Promise<Result<void, AppError>>;
  clear(): Promise<Result<void, AppError>>;
}
