import type { ICredentialStorage } from '../../../core/ports/outbound/ICredentialStorage';
import {
  Credentials,
  type CredentialsProps,
} from '../../../core/domain/credential/Credentials';
import { success, failure, type Result } from '../../../shared/types/Result';
import { StorageError, type AppError } from '../../../shared/errors';
import { isAnyProvider } from '../../../core/domain/credential/Provider';
import * as browser from 'webextension-polyfill';
import { z } from 'zod';

const STORAGE_KEY = 'credentials';
const LEGACY_STORAGE_KEY = 'credential';

const CredentialItemPropsSchema = z.object({
  id: z.string(),
  type: z.literal('API_KEY'),
  provider: z.string(),
  apiKey: z.string(),
});

const CredentialsPropsSchema = z.object({
  id: z.string(),
  activeCredentialId: z.nullable(z.string()),
  items: z.array(CredentialItemPropsSchema),
});

export class BrowserCredentialStorageAdapter implements ICredentialStorage {
  async save(credentials: Credentials): Promise<Result<void, AppError>> {
    try {
      await browser.storage.local.set({
        [STORAGE_KEY]: credentials.toProps(),
      });
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

  async get(): Promise<Result<Credentials | null, AppError>> {
    try {
      const result = await browser.storage.local.get([
        STORAGE_KEY,
        LEGACY_STORAGE_KEY,
      ]);

      if (result[LEGACY_STORAGE_KEY]) {
        await browser.storage.local.remove(LEGACY_STORAGE_KEY);
      }

      const raw = result[STORAGE_KEY];
      if (!raw) {
        return success(null);
      }

      const parsed = CredentialsPropsSchema.safeParse(raw);
      if (!parsed.success) {
        await browser.storage.local.remove(STORAGE_KEY);
        return success(null);
      }

      let changed = false;
      const items: CredentialsProps['items'] = [];
      for (const item of parsed.data.items) {
        if (!isAnyProvider(item.provider)) {
          changed = true;
          continue;
        }
        items.push({ ...item, provider: item.provider });
      }

      let activeCredentialId = parsed.data.activeCredentialId;
      if (activeCredentialId && !items.some((i) => i.id === activeCredentialId)) {
        activeCredentialId = items.length > 0 ? items[0].id : null;
        changed = true;
      }

      const credentialsResult = Credentials.fromProps({
        id: parsed.data.id,
        activeCredentialId,
        items,
      });
      if (!credentialsResult.success) {
        await browser.storage.local.remove(STORAGE_KEY);
        return success(null);
      }

      if (changed) {
        await this.save(credentialsResult.data);
      }

      return success(credentialsResult.data);
    } catch {
      return failure(StorageError.readFailed(STORAGE_KEY));
    }
  }
}
