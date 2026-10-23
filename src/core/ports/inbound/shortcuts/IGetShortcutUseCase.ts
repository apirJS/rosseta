import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';

export interface IGetShortcutUseCase {
  execute(commandName: string): Promise<Result<string | null, AppError>>;
}
