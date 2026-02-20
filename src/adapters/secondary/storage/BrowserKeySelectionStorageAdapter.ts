import type { IKeySelectionStorage } from '../../../core/ports/outbound/IKeySelectionStorage';
import {
  KeySelectionMode,
  type KeySelectionModeValue,
} from '../../../core/domain/credential/KeySelectionMode';
import type { Provider } from '../../../core/domain/credential/Provider';
import { success, failure, type Result } from '../../../shared/types/Result';
import { StorageError, type AppError } from '../../../shared/errors';
import * as browser from 'webextension-polyfill';

const MODE_KEY = 'keySelectionMode';
const LAST_USED_PREFIX = 'lastUsedKeyId:';

export class BrowserKeySelectionStorageAdapter implements IKeySelectionStorage {
  async getMode(): Promise<Result<KeySelectionMode, AppError>> {
    try {
      const result = await browser.storage.local.get(MODE_KEY);
      const raw = result[MODE_KEY] as string | undefined;

      if (!raw) {
        return success(KeySelectionMode.manual());
      }

      const parsed = KeySelectionMode.fromRaw(raw);
      if (!parsed.success) {
        // Invalid stored value → reset to manual
        await browser.storage.local.remove(MODE_KEY);
        return success(KeySelectionMode.manual());
      }

      return success(parsed.data);
    } catch {
      return failure(StorageError.readFailed(MODE_KEY));
    }
  }

  async setMode(mode: KeySelectionMode): Promise<Result<void, AppError>> {
    try {
      await browser.storage.local.set({
        [MODE_KEY]: mode.value satisfies KeySelectionModeValue,
      });
      return success(undefined);
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          MODE_KEY,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  async getLastUsedId(
    provider: Provider,
  ): Promise<Result<string | null, AppError>> {
    try {
      const key = `${LAST_USED_PREFIX}${provider}`;
      const result = await browser.storage.local.get(key);
      const id = result[key] as string | undefined;
      return success(id ?? null);
    } catch {
      return failure(StorageError.readFailed(`${LAST_USED_PREFIX}${provider}`));
    }
  }

  async setLastUsedId(
    provider: Provider,
    credentialId: string,
  ): Promise<Result<void, AppError>> {
    try {
      const key = `${LAST_USED_PREFIX}${provider}`;
      await browser.storage.local.set({ [key]: credentialId });
      return success(undefined);
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          `${LAST_USED_PREFIX}${provider}`,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }
}
