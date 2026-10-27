import type { SettingsBackupData } from '../../../domain/settings/SettingsBackup';
import type { AppError } from '../../../../shared/errors';
import type { Result } from '../../../../shared/types/Result';

export interface IExportSettingsUseCase {
  execute(): Promise<Result<SettingsBackupData, AppError>>;
}
