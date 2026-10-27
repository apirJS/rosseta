import type { ISettingsBackupStorage } from '../../src/core/ports/outbound/ISettingsBackupStorage';
import type { ValidatedSettingsBackup } from '../../src/core/domain/settings/SettingsBackup';
import type { AppError } from '../../src/shared/errors';
import { success, failure, type Result } from '../../src/shared/types/Result';

export class FakeSettingsBackupStorage implements ISettingsBackupStorage {
  readCalls = 0;
  replacements: ValidatedSettingsBackup[] = [];
  error?: AppError;

  constructor(public settings: ValidatedSettingsBackup) {}

  async read(): Promise<Result<ValidatedSettingsBackup, AppError>> {
    this.readCalls++;

    return this.error ? failure(this.error) : success(this.settings);
  }

  async replace(
    settings: ValidatedSettingsBackup,
  ): Promise<Result<void, AppError>> {
    if (this.error) return failure(this.error);
    this.replacements.push(settings);

    this.settings = {
      ...settings,
      history: settings.history ?? this.settings.history,
    };

    return success(undefined);
  }
}
