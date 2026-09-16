import type { ICustomProviderStorage } from '../../../core/ports/outbound/ICustomProviderStorage';
import {
  CustomProviderConfig,
  type CustomProviderConfigProps,
} from '../../../core/domain/provider/CustomProviderConfig';
import { success, failure, type Result } from '../../../shared/types/Result';
import { StorageError, type AppError } from '../../../shared/errors';
import * as browser from 'webextension-polyfill';
import { z } from 'zod';

const STORAGE_KEY = 'customProviders';
const LEGACY_STORAGE_KEY = 'customProviderConfig';

const CustomProviderConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseURL: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.string()).optional(),
});

const CustomProvidersSchema = z.object({
  providers: z.array(CustomProviderConfigSchema),
});

export class BrowserCustomProviderStorageAdapter
  implements ICustomProviderStorage
{
  async load(): Promise<Result<CustomProviderConfig[], AppError>> {
    try {
      const result = await browser.storage.local.get([
        STORAGE_KEY,
        LEGACY_STORAGE_KEY,
      ]);

      if (result[LEGACY_STORAGE_KEY] !== undefined) {
        await browser.storage.local.remove(LEGACY_STORAGE_KEY);
      }

      if (result[STORAGE_KEY] === undefined) {
        return success([]);
      }

      const parsed = CustomProvidersSchema.safeParse(result[STORAGE_KEY]);
      if (!parsed.success) {
        await browser.storage.local.remove(STORAGE_KEY);
        return success([]);
      }

      return success(this.toConfigs(parsed.data.providers));
    } catch {
      return failure(StorageError.readFailed(STORAGE_KEY));
    }
  }

  async save(
    config: CustomProviderConfig,
  ): Promise<Result<void, AppError>> {
    const loadResult = await this.load();
    if (!loadResult.success) {
      return failure(loadResult.error);
    }

    const nextProviders = [
      ...loadResult.data.filter((p) => p.id !== config.id),
      config,
    ];

    return this.persist(nextProviders);
  }

  async remove(id: string): Promise<Result<void, AppError>> {
    const loadResult = await this.load();
    if (!loadResult.success) {
      return failure(loadResult.error);
    }

    return this.persist(loadResult.data.filter((p) => p.id !== id));
  }

  private toConfigs(
    stored: z.infer<typeof CustomProviderConfigSchema>[],
  ): CustomProviderConfig[] {
    const configs: CustomProviderConfig[] = [];
    for (const raw of stored) {
      const configResult = CustomProviderConfig.create(
        raw as CustomProviderConfigProps,
      );
      if (configResult.success) {
        configs.push(configResult.data);
      }
    }
    return configs;
  }

  private async persist(
    providers: CustomProviderConfig[],
  ): Promise<Result<void, AppError>> {
    try {
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          providers: providers.map((provider) => provider.toProps()),
        },
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
}
