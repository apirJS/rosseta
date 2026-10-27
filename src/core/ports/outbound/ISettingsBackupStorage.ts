import type { ValidatedSettingsBackup } from '../../domain/settings/SettingsBackup';
import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';

export interface ISettingsBackupStorage {
  read(): Promise<Result<ValidatedSettingsBackup, AppError>>;
  replace(settings: ValidatedSettingsBackup): Promise<Result<void, AppError>>;
}
