import type { IUserPreferencesStorage } from '../../../core/ports/outbound/IUserPreferencesStorage';
import {
  UserPreferences,
  type UserPreferencesProps,
} from '../../../core/domain/preferences/UserPreferences';
import { success, failure, type Result } from '../../../shared/types/Result';
import { StorageError, type AppError } from '../../../shared/errors';
import * as browser from 'webextension-polyfill';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'userPreferences';

const UserPreferencesSchema = z.object({
  id: z.string().optional(),
  targetLanguage: z.string().optional(),
  selectedModel: z.string().optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
});

export class BrowserUserPreferencesStorageAdapter implements IUserPreferencesStorage {
  async set(
    preferences: Partial<UserPreferencesProps>,
  ): Promise<Result<void, AppError>> {
    try {
      const existingResult = await this.get();
      const existing = existingResult.success ? existingResult.data : null;
      const existingProps = existing?.toProps() ?? { id: uuidv4() };
      const merged = { ...existingProps, ...preferences };

      await browser.storage.local.set({ [STORAGE_KEY]: merged });
      return success(undefined);
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          STORAGE_KEY,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  async get(): Promise<Result<UserPreferences | null, AppError>> {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const raw = result[STORAGE_KEY];

      if (!raw) {
        return success(null);
      }

      const parsed = UserPreferencesSchema.safeParse(raw);
      if (!parsed.success) {
        await browser.storage.local.remove(STORAGE_KEY);
        return success(null);
      }

      const dataWithId = {
        ...parsed.data,
        id: parsed.data.id ?? uuidv4(),
      };

      const preferencesResult = UserPreferences.fromRaw(dataWithId);
      if (!preferencesResult.success) {
        await browser.storage.local.remove(STORAGE_KEY);
        return success(null);
      }

      return success(preferencesResult.data);
    } catch (error) {
      return failure(StorageError.readFailed(STORAGE_KEY));
    }
  }

  async clear(): Promise<Result<void, AppError>> {
    try {
      await browser.storage.local.remove(STORAGE_KEY);
      return success(undefined);
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          STORAGE_KEY,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }
}
