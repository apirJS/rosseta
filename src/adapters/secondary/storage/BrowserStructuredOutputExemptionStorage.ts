import { z } from 'zod';
import type { IStructuredOutputExemptionStorage } from '../../../core/ports/outbound/IStructuredOutputExemptionStorage';
import { success, failure, type Result } from '../../../shared/types/Result';
import { StorageError, type AppError } from '../../../shared/errors';
import * as browser from 'webextension-polyfill';

const STORAGE_KEY = 'structuredOutputExemptModels';

const exemptModelsSchema = z.array(z.string());

export class BrowserStructuredOutputExemptionStorage
  implements IStructuredOutputExemptionStorage
{
  async isExempt(modelKey: string): Promise<Result<boolean, AppError>> {
    try {
      const models = await this.readAll();
      return success(models.includes(modelKey));
    } catch {
      return failure(StorageError.readFailed(STORAGE_KEY));
    }
  }

  async exemptModel(modelKey: string): Promise<Result<void, AppError>> {
    try {
      const models = await this.readAll();
      if (models.includes(modelKey)) {
        return success(undefined);
      }
      await browser.storage.local.set({
        [STORAGE_KEY]: [...models, modelKey],
      });
      return success(undefined);
    } catch {
      return failure(StorageError.writeFailed(STORAGE_KEY));
    }
  }

  private async readAll(): Promise<string[]> {
    const result = await browser.storage.local.get(STORAGE_KEY);
    const raw: unknown = result[STORAGE_KEY];
    if (raw === undefined) {
      return [];
    }

    const parsed = exemptModelsSchema.safeParse(raw);
    if (!parsed.success) {
      await browser.storage.local.remove(STORAGE_KEY);
      return [];
    }
    return parsed.data;
  }
}
