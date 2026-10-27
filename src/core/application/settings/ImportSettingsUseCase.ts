import type { IImportSettingsUseCase } from '../../ports/inbound/settings/IImportSettingsUseCase';
import type { ISettingsBackupStorage } from '../../ports/outbound/ISettingsBackupStorage';
import { parseSettingsBackup } from '../../domain/settings/SettingsBackup';
import { AppError, ErrorCode, ValidationError } from '../../../shared/errors';
import { failure, type Result } from '../../../shared/types/Result';

export class ImportSettingsUseCase implements IImportSettingsUseCase {
  constructor(private readonly storage: ISettingsBackupStorage) {}

  async execute(data: unknown): Promise<Result<void, AppError>> {
    try {
      const parsed = parseSettingsBackup(data);

      if (!parsed.success) {
        return failure(ValidationError.invalidInput(parsed.error.message));
      }

      return await this.storage.replace(parsed.data);
    } catch (error) {
      return failure(
        AppError.fromUnknown(error, ErrorCode.STORAGE_WRITE_FAILED),
      );
    }
  }
}
