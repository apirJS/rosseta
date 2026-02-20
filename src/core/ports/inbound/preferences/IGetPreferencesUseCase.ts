import type { UserPreferences } from '../../../domain/preferences/UserPreferences';
import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';

export interface IGetPreferencesUseCase {
  execute(): Promise<Result<UserPreferences | null, AppError>>;
}
