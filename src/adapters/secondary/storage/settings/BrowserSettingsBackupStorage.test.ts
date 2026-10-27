import { beforeEach, describe, expect, test } from 'bun:test';
import {
  browserMock,
  resetBrowserMock,
  seedStore,
} from '../../../../../tests/browser-mock';
import { BrowserSettingsBackupStorage } from './BrowserSettingsBackupStorage';
import { settingsBackupFixture } from '../../../../../tests/settings-backup-fixtures';
import { parseSettingsBackup } from '../../../../core/domain/settings/SettingsBackup';
import { ExportSettingsUseCase } from '../../../../core/application/settings/ExportSettingsUseCase';
import { ImportSettingsUseCase } from '../../../../core/application/settings/ImportSettingsUseCase';
import { BrowserTranslationStorageAdapter } from '../history/BrowserTranslationStorageAdapter';
import { BrowserProviderMutationLock } from '../providers/BrowserProviderMutationLock';
import { success } from '../../../../shared/types/Result';
import { Translation } from '../../../../core/domain/translation/Translation';
import { BrowserCredentialStorageAdapter } from '../credentials/BrowserCredentialStorageAdapter';
import { BrowserUserPreferencesStorageAdapter } from '../preferences/BrowserUserPreferencesStorageAdapter';
import { BrowserCustomProviderStorageAdapter } from '../providers/BrowserCustomProviderStorageAdapter';
import { makeCustomProviderConfig } from '../../../../../tests/fakes/FakeCustomProviderStorage';
import { RemoveApiKeyUseCase } from '../../../../core/application/credentials/RemoveApiKeyUseCase';

const now = Date.parse('2026-10-28T00:00:00.000Z');
const adapter = new BrowserSettingsBackupStorage(() => now);
const storage = browserMock.storage.local;

function parsedBackup() {
  const backup = settingsBackupFixture();
  const parsed = parseSettingsBackup(backup);

  if (!parsed.success) throw parsed.error;

  return { backup, settings: parsed.data };
}

function rawSettings() {
  const { backup, settings } = parsedBackup();

  return {
    credentials: settings.credentials.toProps(),
    userPreferences: { id: 'existing-preferences', ...settings.preferences },
    customProviders: { providers: [] },
    'models:openai': backup.settings.models.openai,
    translations: backup.settings.history,
    keySelectionMode: 'manual',
    'lastUsedKeyId:openai': 'key-1',
  };
}

beforeEach(resetBrowserMock);

describe('BrowserSettingsBackupStorage', () => {
  test('exports persisted preferences with one non-destructive snapshot and no writes', async () => {
    seedStore({
      ...rawSettings(),
      translationCapabilitiesV1: { secret: 'operational' },
    });

    const exported = await new ExportSettingsUseCase(adapter).execute();

    expect(exported.success).toBe(true);
    if (!exported.success) throw exported.error;
    expect(exported.data.settings).toEqual(settingsBackupFixture().settings);
    expect(storage.get).toHaveBeenCalledTimes(1);
    expect(storage.get).toHaveBeenCalledWith(null);
    expect(storage.set).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled();
  });

  test('exports valid defaults when no settings have been saved', async () => {
    const result = await new ExportSettingsUseCase(adapter).execute();

    expect(result.success).toBe(true);
    if (!result.success) throw result.error;
    expect(parseSettingsBackup(result.data).success).toBe(true);
    expect(result.data.settings.apiKeys).toEqual([]);
    expect(result.data.settings.history).toEqual([]);
    expect(result.data.settings.preferences.theme).toBe('system');
    expect(storage.set).not.toHaveBeenCalled();
  });

  test.each([
    { credentials: null },
    { credentials: { items: [] } },
    { customProviders: { providers: [null] } },
    { userPreferences: { theme: 'rainbow' } },
    { userPreferences: { selectedModels: { openai: 42 } } },
    { translations: null },
    { 'models:openai': [{ id: 'broken' }] },
    { 'models:custom-unknown': [] },
    { 'lastUsedKeyId:openai': 42 },
    { keySelectionMode: 'invalid' },
  ])(
    'rejects corrupt stored values without silently removing data: %j',
    async (invalid) => {
      const stored = { ...rawSettings(), ...invalid };

      seedStore(stored);
      expect((await adapter.read()).success).toBe(false);
      expect(storage.set).not.toHaveBeenCalled();
      expect(storage.remove).not.toHaveBeenCalled();
      expect(await storage.get(null)).toEqual(stored);
    },
  );

  test('preserves legacy optional preference defaults', async () => {
    seedStore({ userPreferences: { targetLanguage: 'ja-JP' } });

    const result = await adapter.read();

    expect(result.success).toBe(true);
    if (!result.success) throw result.error;

    expect(result.data.preferences).toEqual({
      theme: 'system',
      targetLanguage: 'ja-JP',
      selectedModels: {},
      includeDescription: true,
    });
  });

  test('exports effective rotation settings when deleted keys left stale cursors or mode', async () => {
    seedStore({
      ...rawSettings(),
      'lastUsedKeyId:openai': 'deleted-key',
      keySelectionMode: 'auto-balance:openai',
    });

    const result = await adapter.read();

    expect(result.success).toBe(true);
    if (!result.success) throw result.error;
    expect(result.data.keySelectionMode.isManual).toBe(true);
    expect(result.data.lastUsedKeyIds).toEqual({});
    expect(storage.set).not.toHaveBeenCalled();

    expect(
      (await storage.get('lastUsedKeyId:openai'))['lastUsedKeyId:openai'],
    ).toBe('deleted-key');
  });

  test('replaces all imported data in one scoped set and leaves unrelated state alone', async () => {
    seedStore({
      ...rawSettings(),
      'models:groq': [{ id: 'old', name: 'Old', source: 'manual' }],
      'lastUsedKeyId:groq': 'old-key',
      translationCapabilitiesV1: { facts: ['keep'] },
      unrelated: { value: 1 },
    });

    expect((await adapter.replace(parsedBackup().settings)).success).toBe(true);
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.remove).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled();

    const stored = await storage.get(null);

    expect(stored['models:groq']).toBeNull();
    expect(stored['lastUsedKeyId:groq']).toBeNull();
    expect(stored.translationCapabilitiesV1).toEqual({ facts: ['keep'] });
    expect(stored.unrelated).toEqual({ value: 1 });

    expect((stored.userPreferences as { id: string }).id).toBe(
      'existing-preferences',
    );

    const roundTrip = await new ExportSettingsUseCase(adapter).execute();

    expect(roundTrip.success && roundTrip.data.settings).toEqual(
      settingsBackupFixture().settings,
    );
  });

  test('a failed bulk write leaves every prior setting and history record intact', async () => {
    const stored = { ...rawSettings(), unrelated: 'keep' };

    seedStore(stored);

    const next = parsedBackup().settings;

    next.preferences.theme = 'light';
    next.history = [];

    storage.set.mockImplementationOnce(async () => {
      throw new Error('quota');
    });

    expect((await adapter.replace(next)).success).toBe(false);
    expect(await storage.get(null)).toEqual(stored);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  test('a failed snapshot read prevents replacement and export', async () => {
    storage.get.mockImplementationOnce(async () => {
      throw new Error('unavailable');
    });

    expect((await adapter.replace(parsedBackup().settings)).success).toBe(
      false,
    );

    storage.get.mockImplementationOnce(async () => {
      throw new Error('unavailable');
    });

    expect((await adapter.read()).success).toBe(false);
    expect(storage.set).not.toHaveBeenCalled();
  });

  test('an import can replace malformed prefix entries without treating them as lock names', async () => {
    seedStore({
      'models:settings-backup': 'invalid',
      customProviders: { providers: [{ id: 'settings-backup' }] },
    });

    expect((await adapter.replace(parsedBackup().settings)).success).toBe(true);

    expect(
      (await storage.get('models:settings-backup'))['models:settings-backup'],
    ).toBeNull();
  });

  test('a valid provider id cannot collide with the custom-provider collection boundary', async () => {
    const { backup } = parsedBackup();

    backup.settings.customProviders.push({
      id: 'custom-providers',
      name: 'Custom providers',
      baseURL: 'https://example.com/v1',
    });

    expect(
      (await new ImportSettingsUseCase(adapter).execute(backup)).success,
    ).toBe(true);

    const exported = await new ExportSettingsUseCase(adapter).execute();

    expect(
      exported.success && exported.data.settings.customProviders[0]?.id,
    ).toBe('custom-providers');
  });

  test('omitted history is untouched while an explicit empty array clears it', async () => {
    seedStore(rawSettings());

    const { backup } = parsedBackup();
    const { history: _history, ...settings } = backup.settings;
    const importing = new ImportSettingsUseCase(adapter);

    expect((await importing.execute({ ...backup, settings })).success).toBe(
      true,
    );

    expect(
      (storage.set.mock.calls[0]![0] as Record<string, unknown>).translations,
    ).toBeUndefined();

    expect((await storage.get('translations')).translations).toEqual(
      backup.settings.history,
    );

    expect(
      (
        await importing.execute({
          ...backup,
          settings: { ...settings, history: [] },
        })
      ).success,
    ).toBe(true);

    expect((await storage.get('translations')).translations).toEqual([]);
  });

  test('applies the same inclusive 90-day history boundary on import and export', async () => {
    const { backup } = parsedBackup();
    const entry = backup.settings.history[0]!;
    const boundary = now - 90 * 24 * 60 * 60 * 1000;

    backup.settings.history = [
      { ...entry, id: 'boundary', createdAt: new Date(boundary).toISOString() },
      {
        ...entry,
        id: 'expired',
        createdAt: new Date(boundary - 1).toISOString(),
      },
    ];

    expect(
      (await new ImportSettingsUseCase(adapter).execute(backup)).success,
    ).toBe(true);

    const stored = await storage.get('translations');

    expect(
      (stored.translations as { id: string }[]).map((item) => item.id),
    ).toEqual(['boundary']);

    seedStore({ translations: backup.settings.history });

    const read = await adapter.read();

    expect(read.success && read.data.history?.map((item) => item.id)).toEqual([
      'boundary',
    ]);

    expect((await storage.get('translations')).translations).toHaveLength(2);
  });

  test.each([
    'openai',
    'credentials',
    'preferences',
    'settings-custom-providers',
  ])(
    'waits for the %s mutation boundary before replacing settings',
    async (boundary) => {
      let release!: () => void;
      let entered!: () => void;

      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });

      const waiting = new Promise<void>((resolve) => {
        release = resolve;
      });

      const holding = new BrowserProviderMutationLock().run(
        boundary,
        async () => {
          entered();
          await waiting;

          return success(undefined);
        },
      );

      await started;

      const replacing = adapter.replace(parsedBackup().settings);

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(storage.set).not.toHaveBeenCalled();
      release();
      await holding;
      expect((await replacing).success).toBe(true);
    },
  );

  test.each([
    'credentials',
    'preferences',
    'settings-custom-providers',
  ] as const)(
    'does not let an earlier %s read-modify-write overwrite the import',
    async (kind) => {
      seedStore(rawSettings());

      const write = storage.set.getMockImplementation()!;
      let release!: () => void;
      let entered!: () => void;

      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });

      const waiting = new Promise<void>((resolve) => {
        release = resolve;
      });

      storage.set.mockImplementationOnce(async (items) => {
        entered();
        await waiting;

        return write(items);
      });

      const pending =
        kind === 'credentials'
          ? new RemoveApiKeyUseCase(
              new BrowserCredentialStorageAdapter(),
            ).execute('key-1')
          : kind === 'preferences'
            ? new BrowserUserPreferencesStorageAdapter().set({ theme: 'light' })
            : new BrowserCustomProviderStorageAdapter().save(
                makeCustomProviderConfig({ id: 'custom-earlier-change' }),
              );

      await started;

      const importing = adapter.replace(parsedBackup().settings);

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(storage.set).toHaveBeenCalledTimes(1);
      release();
      expect((await pending).success).toBe(true);
      expect((await importing).success).toBe(true);

      const exported = await new ExportSettingsUseCase(adapter).execute();

      expect(exported.success && exported.data.settings).toEqual(
        settingsBackupFixture().settings,
      );
    },
  );

  test('a concurrent history save cannot overwrite or be lost behind the import', async () => {
    const write = storage.set.getMockImplementation()!;
    let release!: () => void;
    let entered!: () => void;

    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });

    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });

    storage.set.mockImplementationOnce(async (items) => {
      entered();
      await waiting;

      return write(items);
    });

    const replacing = adapter.replace(parsedBackup().settings);

    await started;

    const entry = parsedBackup().settings.history![0]!;

    const saving = new BrowserTranslationStorageAdapter(() => now).save(
      Translation.create(
        'concurrent',
        entry.original,
        entry.translated,
        entry.description,
        entry.createdAt,
      ),
    );

    release();
    expect((await replacing).success).toBe(true);
    expect((await saving).success).toBe(true);

    const read = await adapter.read();

    expect(read.success && read.data.history?.map((item) => item.id)).toEqual([
      'concurrent',
      'history-1',
    ]);
  });
});
