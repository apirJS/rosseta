import type { ICommandStorage } from '../../src/core/ports/outbound/ICommandStorage';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';

export class FakeCommandStorage implements ICommandStorage {
  private shortcutValues = new Map<string, string>();
  private injectedError: AppError | null = null;

  /** Seed the fake with a shortcut for a command */
  seedShortcut(commandName: string, shortcut: string): void {
    this.shortcutValues.set(commandName, shortcut);
  }

  /** Make the next call fail once with the given error */
  failNextCallWith(error: AppError): void {
    this.injectedError = error;
  }

  async getShortcut(
    commandName: string,
  ): Promise<Result<string | null, AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }
    return success(this.shortcutValues.get(commandName) ?? null);
  }
}
