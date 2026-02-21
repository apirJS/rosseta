import type { ICommandStorage } from '../../src/core/ports/outbound/ICommandStorage';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';

export class FakeCommandStorage implements ICommandStorage {
  private _shortcuts = new Map<string, string>();
  private _error: AppError | null = null;

  /** Seed the fake with a shortcut for a command */
  seedShortcut(commandName: string, shortcut: string): void {
    this._shortcuts.set(commandName, shortcut);
  }

  /** Make the next call fail once with the given error */
  failNextCallWith(error: AppError): void {
    this._error = error;
  }

  async getShortcut(
    commandName: string,
  ): Promise<Result<string | null, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }
    return success(this._shortcuts.get(commandName) ?? null);
  }
}
