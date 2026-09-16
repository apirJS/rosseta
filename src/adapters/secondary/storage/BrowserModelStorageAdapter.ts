import type { IModelStorage, StoredModel } from '../../../core/ports/outbound/IModelStorage';
import { success, failure, type Result } from '../../../shared/types/Result';
import { StorageError, type AppError } from '../../../shared/errors';
import * as browser from 'webextension-polyfill';
import { z } from 'zod';

const MODELS_PREFIX = 'models:';

const StoredModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.enum(['fetched', 'manual']),
});

const StoredModelsSchema = z.array(StoredModelSchema);

export class BrowserModelStorageAdapter implements IModelStorage {
  async getModels(provider: string): Promise<Result<StoredModel[], AppError>> {
    try {
      const key = `${MODELS_PREFIX}${provider}`;
      const result = await browser.storage.local.get(key);
      const raw = result[key];

      if (raw === undefined) {
        return success([]);
      }

      const parsed = StoredModelsSchema.safeParse(raw);
      if (!parsed.success) {
        await browser.storage.local.remove(key);
        return success([]);
      }

      return success(parsed.data);
    } catch {
      return failure(StorageError.readFailed(`${MODELS_PREFIX}${provider}`));
    }
  }

  async getAllModels(): Promise<
    Result<Record<string, StoredModel[]>, AppError>
  > {
    try {
      const all = (await browser.storage.local.get(null)) as Record<
        string,
        unknown
      >;

      const byProvider: Record<string, StoredModel[]> = {};
      for (const [key, raw] of Object.entries(all)) {
        if (!key.startsWith(MODELS_PREFIX)) continue;

        const parsed = StoredModelsSchema.safeParse(raw);
        if (!parsed.success) {
          await browser.storage.local.remove(key);
          continue;
        }

        byProvider[key.slice(MODELS_PREFIX.length)] = parsed.data;
      }

      return success(byProvider);
    } catch {
      return failure(StorageError.readFailed('models:*'));
    }
  }

  async setModels(
    provider: string,
    models: StoredModel[],
  ): Promise<Result<void, AppError>> {
    try {
      const key = `${MODELS_PREFIX}${provider}`;
      await browser.storage.local.set({ [key]: models });
      return success(undefined);
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          `${MODELS_PREFIX}${provider}`,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  async clearModels(provider: string): Promise<Result<void, AppError>> {
    try {
      const key = `${MODELS_PREFIX}${provider}`;
      await browser.storage.local.remove(key);
      return success(undefined);
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          `${MODELS_PREFIX}${provider}`,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }
}
