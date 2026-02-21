import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export interface ICommandStorage {
  getShortcut(commandName: string): Promise<Result<string | null, AppError>>;
}
