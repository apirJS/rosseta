import type { IKeySelectionStorage } from '../../../core/ports/outbound/IKeySelectionStorage';
import {
  KeySelectionMode,
  type KeySelectionModeValue,
} from '../../../core/domain/credential/KeySelectionMode';
import type { AnyProvider } from '../../../core/domain/credential/Provider';

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
    provider: AnyProvider,
  ): Promise<Result<string | null, AppError>> {
    try {
      const key = `${LAST_USED_PREFIX}${provider}`;
      const result = await browser.storage.local.get(key);
      const id = result[key] as string | undefined;
      if (id) return success(id);

      return success(null);
    } catch {
      return failure(StorageError.readFailed(`${LAST_USED_PREFIX}${provider}`));
    }
  }

  async setLastUsedId(
    provider: AnyProvider,
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

  async getAllLastUsedIds(): Promise<
    Result<Record<string, string>, AppError>
  > {
    try {
      const all = (await browser.storage.local.get(null)) as Record<
        string,
        unknown
      >;
      const ids: Record<string, string> = {};

      for (const [key, value] of Object.entries(all)) {
        if (!key.startsWith(LAST_USED_PREFIX) || typeof value !== 'string') {
          continue;
        }
        ids[key.slice(LAST_USED_PREFIX.length)] = value;
      }

      return success(ids);
    } catch {
      return failure(StorageError.readFailed(`${LAST_USED_PREFIX}*`));
    }
  }

  async replaceLastUsedIds(
    ids: Record<string, string>,
  ): Promise<Result<void, AppError>> {
    try {
      const all = (await browser.storage.local.get(null)) as Record<
        string,
        unknown
      >;
      const existingKeys = Object.keys(all).filter((key) =>
        key.startsWith(LAST_USED_PREFIX),
      );
      const nextEntries = Object.fromEntries(
        Object.entries(ids).map(([provider, credentialId]) => [
          `${LAST_USED_PREFIX}${provider}`,
          credentialId,
        ]),
      );

      if (Object.keys(nextEntries).length > 0) {
        await browser.storage.local.set(nextEntries);
      }

      const nextKeys = new Set(Object.keys(nextEntries));
      const staleKeys = existingKeys.filter((key) => !nextKeys.has(key));
      if (staleKeys.length > 0) {
        await browser.storage.local.remove(staleKeys);
      }

      return success(undefined);
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          `${LAST_USED_PREFIX}*`,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }
}
