import type { ICommandStorage } from '../../../core/ports/outbound/ICommandStorage';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import { success, failure } from '../../../shared/types/Result';
import { BrowserError } from '../../../shared/errors';
import browser from 'webextension-polyfill';

export class BrowserCommandStorageAdapter implements ICommandStorage {
  async getShortcut(
    commandName: string,
  ): Promise<Result<string | null, AppError>> {
    try {
      const commands = await browser.commands.getAll();
      const command = commands.find((c) => c.name === commandName);
      return success(command?.shortcut || null);
    } catch (error) {
      return failure(
        BrowserError.communicationFailed(
          error instanceof Error ? error : new Error(String(error)),
        ),
      );
    }
  }
}
