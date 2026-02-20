import type { UserPreferencesProps } from '../../../domain/preferences/UserPreferences';
import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';

export interface UpdatePreferencesCommand {
  preferences: Partial<UserPreferencesProps>;
}

export interface IUpdatePreferencesUseCase {
  execute(command: UpdatePreferencesCommand): Promise<Result<void, AppError>>;
}
