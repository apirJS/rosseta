import type { ICredentialStorage } from '../../../core/ports/outbound/ICredentialStorage';
import {
  Credentials,
  type CredentialsProps,
} from '../../../core/domain/credential/Credentials';
import { success, failure, type Result } from '../../../shared/types/Result';
import { StorageError, type AppError } from '../../../shared/errors';
import * as browser from 'webextension-polyfill';
import { z } from 'zod';

const STORAGE_KEY = 'credentials';
const LEGACY_STORAGE_KEY = 'credential';

const CredentialItemPropsSchema = z.object({
  id: z.string(),
  type: z.literal('API_KEY'),
  provider: z.enum(['gemini', 'groq']),
  apiKey: z.string(),
});

const CredentialsPropsSchema = z.object({
  id: z.string(),
  activeCredentialId: z.nullable(z.string()),
  items: z.array(CredentialItemPropsSchema),
});

const LegacyCredentialSchema = z.object({
  id: z.string(),
  type: z.literal('API_KEY'),
  apiKey: z.string(),
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
      const raw = result[STORAGE_KEY];

      if (raw) {
        const parsed = CredentialsPropsSchema.safeParse(raw);
        if (!parsed.success) {
          await browser.storage.local.remove(STORAGE_KEY);
          return success(null);
        }

        const credentialsResult = Credentials.fromProps(
          parsed.data as CredentialsProps,
        );
        if (!credentialsResult.success) {
          await browser.storage.local.remove(STORAGE_KEY);
          return success(null);
        }

        return success(credentialsResult.data);
      }

      // Migration: convert legacy single credential to Credentials aggregate
      const legacyRaw = result[LEGACY_STORAGE_KEY];
      if (legacyRaw) {
        const legacyParsed = LegacyCredentialSchema.safeParse(legacyRaw);
        if (legacyParsed.success) {
          const migratedProps: CredentialsProps = {
            id: 'migrated',
            activeCredentialId: legacyParsed.data.id,
            items: [
              {
                id: legacyParsed.data.id,
                type: 'API_KEY',
                provider: 'gemini',
                apiKey: legacyParsed.data.apiKey,
              },
            ],
          };

          const credentialsResult = Credentials.fromProps(migratedProps);
          if (credentialsResult.success) {
            await this.save(credentialsResult.data);
            await browser.storage.local.remove(LEGACY_STORAGE_KEY);
            return success(credentialsResult.data);
          }
        }

        await browser.storage.local.remove(LEGACY_STORAGE_KEY);
      }

      return success(null);
    } catch (error) {
      return failure(StorageError.readFailed(STORAGE_KEY));
    }
  }
}
