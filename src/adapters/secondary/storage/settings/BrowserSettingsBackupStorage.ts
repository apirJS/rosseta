import * as browser from 'webextension-polyfill';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import type { ISettingsBackupStorage } from '../../../../core/ports/outbound/ISettingsBackupStorage';
import {
  parseSettingsBackup,
  type ValidatedSettingsBackup,
} from '../../../../core/domain/settings/SettingsBackup';
import { UserPreferences } from '../../../../core/domain/preferences/UserPreferences';
import {
  PROVIDERS,
  isAnyProvider,
} from '../../../../core/domain/credential/Provider';
import { KeySelectionMode } from '../../../../core/domain/credential/KeySelectionMode';
import { isWithinHistoryRetention } from '../../../../core/domain/translation/translation-history-retention';
import { StorageError, type AppError } from '../../../../shared/errors';
import { failure, success, type Result } from '../../../../shared/types/Result';
import { BrowserProviderMutationLock } from '../providers/BrowserProviderMutationLock';
import { serializeHistoryStorage } from '../history/translation-history-lock';

const credentialsSchema = z.object({
  id: z.string(),
  activeCredentialId: z.string().nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      type: z.literal('API_KEY'),
      provider: z.string(),
      apiKey: z.string(),
    }),
  ),
});

const providersSchema = z.object({ providers: z.array(z.unknown()) });

const preferencesSchema = z.object({
  id: z.string().optional(),
  theme: z.string().optional(),
  targetLanguage: z.string().optional(),
  selectedModels: z.record(z.string(), z.string()).optional(),
  includeDescription: z.boolean().optional(),
});

export class BrowserSettingsBackupStorage implements ISettingsBackupStorage {
  private readonly lock = new BrowserProviderMutationLock();

  constructor(private readonly now: () => number = Date.now) {}

  async read(): Promise<Result<ValidatedSettingsBackup, AppError>> {
    try {
      const stored = await browser.storage.local.get(null);

      const credentials =
        stored.credentials === undefined
          ? undefined
          : credentialsSchema.parse(stored.credentials);

      const providers =
        stored.customProviders === undefined
          ? []
          : providersSchema.parse(stored.customProviders).providers;

      const defaults = UserPreferences.createDefault('settings').toProps();

      const preferences =
        stored.userPreferences === undefined
          ? defaults
          : {
              ...defaults,
              ...preferencesSchema.parse(stored.userPreferences),
            };

      const models = Object.fromEntries(
        Object.entries(stored)
          .filter(([key, value]) => key.startsWith('models:') && value !== null)
          .map(([key, value]) => [key.slice('models:'.length), value]),
      );

      const cursors = z.record(z.string(), z.string()).parse(
        Object.fromEntries(
          Object.entries(stored)
            .filter(
              ([key, value]) =>
                key.startsWith('lastUsedKeyId:') && value !== null,
            )
            .map(([key, value]) => [key.slice('lastUsedKeyId:'.length), value]),
        ),
      );

      const mode = KeySelectionMode.fromRaw(
        z
          .string()
          .parse(
            stored.keySelectionMode === undefined
              ? 'manual'
              : stored.keySelectionMode,
          ),
      );

      if (!mode.success) return failure(this.invalidStoredSettings());

      const activeMode =
        mode.data.autoBalanceProvider &&
        (credentials?.items.filter(
          (key) => key.provider === mode.data.autoBalanceProvider,
        ).length ?? 0) < 2
          ? 'manual'
          : mode.data.value;

      const activeCursors = Object.fromEntries(
        Object.entries(cursors).filter(([provider, id]) =>
          credentials?.items.some(
            (key) => key.provider === provider && key.id === id,
          ),
        ),
      );

      const parsed = parseSettingsBackup({
        format: 'rosseta-settings',
        version: 1,
        exportedAt: new Date(this.now()).toISOString(),
        settings: {
          apiKeys:
            credentials?.items.map(({ id, provider, apiKey }) => ({
              id,
              provider,
              apiKey,
            })) ?? [],
          activeKeyId: credentials?.activeCredentialId ?? null,
          preferences,
          customProviders: providers,
          models,
          history: stored.translations === undefined ? [] : stored.translations,
          keySelection: { mode: activeMode, lastUsedKeyIds: activeCursors },
        },
      });

      if (!parsed.success) return failure(this.invalidStoredSettings());

      return success({
        ...parsed.data,
        history: parsed.data.history!.filter((entry) =>
          isWithinHistoryRetention(entry.createdAt, this.now()),
        ),
      });
    } catch {
      return failure(StorageError.readFailed('settings-backup'));
    }
  }

  async replace(
    settings: ValidatedSettingsBackup,
  ): Promise<Result<void, AppError>> {
    try {
      return await this.lock.run('settings-backup', async () => {
        const stored = await browser.storage.local.get(null);
        const existing = providersSchema.safeParse(stored.customProviders);

        const providerIds = new Set<string>([
          ...PROVIDERS,
          ...settings.customProviders.map((provider) => provider.id),
          ...(existing.success
            ? existing.data.providers.flatMap((provider) => {
                const id = z.object({ id: z.string() }).safeParse(provider);

                return id.success ? [id.data.id] : [];
              })
            : []),
          ...Object.keys(stored)
            .filter((key) => key.startsWith('models:'))
            .map((key) => key.slice('models:'.length)),
        ]);

        const providers = [...providerIds].filter(isAnyProvider).toSorted();

        const replace = (index: number): Promise<Result<void, AppError>> =>
          index < providers.length
            ? this.lock.run(providers[index], () => replace(index + 1))
            : this.lock.run('settings-custom-providers', () =>
                this.lock.run('credentials', () =>
                  this.lock.run('preferences', () =>
                    serializeHistoryStorage(() => this.write(settings)),
                  ),
                ),
              );

        return replace(0);
      });
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          'settings-backup',
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  private async write(
    settings: ValidatedSettingsBackup,
  ): Promise<Result<void, AppError>> {
    const stored = await browser.storage.local.get(null);

    const currentPreferences = preferencesSchema.safeParse(
      stored.userPreferences,
    );

    const entries: Record<string, unknown> = {
      credentials: settings.credentials.toProps(),
      userPreferences: {
        id: currentPreferences.success
          ? (currentPreferences.data.id ?? uuid())
          : uuid(),
        ...settings.preferences,
      },
      customProviders: {
        providers: settings.customProviders.map((provider) =>
          provider.toProps(),
        ),
      },
      keySelectionMode: settings.keySelectionMode.value,
    };

    for (const key of Object.keys(stored)) {
      if (key.startsWith('models:') || key.startsWith('lastUsedKeyId:'))
        entries[key] = null;
    }

    for (const [provider, models] of Object.entries(settings.models))
      entries[`models:${provider}`] = models;
    for (const [provider, id] of Object.entries(settings.lastUsedKeyIds))
      entries[`lastUsedKeyId:${provider}`] = id;

    if (settings.history !== null) {
      entries.translations = settings.history
        .filter((entry) =>
          isWithinHistoryRetention(entry.createdAt, this.now()),
        )
        .map((entry) => entry.toProps());
    }

    await browser.storage.local.set(entries);

    return success(undefined);
  }

  private invalidStoredSettings(): StorageError {
    return new StorageError({
      message: 'Stored settings are invalid',
      userMessage:
        'Some saved settings are invalid, so a complete backup could not be created. Your saved data was not changed.',
    });
  }
}
