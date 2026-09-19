import type { AppError } from '../../../../shared/errors';
import type { Result } from '../../../../shared/types/Result';

export interface IImportSettingsUseCase {
  execute(data: unknown): Promise<Result<void, AppError>>;
}
