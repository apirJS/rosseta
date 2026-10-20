import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { KeySelectionMode } from '../../../domain/credential/KeySelectionMode';

export interface IGetKeySelectionModeUseCase {
  execute(): Promise<Result<KeySelectionMode, AppError>>;
}
