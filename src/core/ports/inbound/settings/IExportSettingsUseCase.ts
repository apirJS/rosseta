import type {
  SettingsBackupData,
  SettingsPreferences,
} from '../../../domain/settings/SettingsBackup';
import type { AppError } from '../../../../shared/errors';
import type { Result } from '../../../../shared/types/Result';

export interface IExportSettingsUseCase {
  execute(
    preferences: SettingsPreferences,
  ): Promise<Result<SettingsBackupData, AppError>>;
}
