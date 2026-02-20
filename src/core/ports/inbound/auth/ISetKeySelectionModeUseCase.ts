import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { KeySelectionMode } from '../../../domain/credential/KeySelectionMode';

export interface ISetKeySelectionModeUseCase {
  execute(mode: KeySelectionMode): Promise<Result<void, AppError>>;
}
