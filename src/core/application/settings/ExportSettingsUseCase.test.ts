import { describe, expect, test } from 'bun:test';
import { ExportSettingsUseCase } from './ExportSettingsUseCase';
import { parseSettingsBackup } from '../../domain/settings/SettingsBackup';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { FakeCustomProviderStorage } from '../../../../tests/fakes/FakeCustomProviderStorage';
import { FakeKeySelectionStorage } from '../../../../tests/fakes/FakeKeySelectionStorage';
import { FakeTranslationStorage } from '../../../../tests/fakes/FakeTranslationStorage';
import { settingsBackupFixture } from '../../../../tests/settings-backup-fixtures';
import { StorageError } from '../../../shared/errors';

function fixture() {
  const credentials = new FakeCredentialStorage();
  const models = new FakeModelStorage();
  const providers = new FakeCustomProviderStorage();
  const keys = new FakeKeySelectionStorage();
  const history = new FakeTranslationStorage();
  const useCase = new ExportSettingsUseCase(
    credentials,
    models,
    providers,
    keys,
    history,
  );
  return { credentials, models, providers, keys, history, useCase };
}

describe('Application: ExportSettingsUseCase', () => {
  test('exports unchanged version-one history and excludes operational capability facts', async () => {
    const backup = settingsBackupFixture();
    const parsed = parseSettingsBackup(backup);
    if (!parsed.success) throw parsed.error;
    const f = fixture();
    f.credentials.seedWith(parsed.data.credentials);
    f.models.seedModels('openai', backup.settings.models.openai!);
    for (const translation of parsed.data.history ?? [])
      f.history.seed(translation);
    f.keys.seedLastUsedId('openai', 'key-1');

    const result = await f.useCase.execute(backup.settings.preferences);
    expect(result.success).toBe(true);
    if (!result.success) throw result.error;
    expect(result.data.format).toBe('rosseta-settings');
    expect(result.data.version).toBe(1);
    expect(Number.isNaN(Date.parse(result.data.exportedAt))).toBe(false);
    expect(result.data.settings).toEqual(backup.settings);
    expect(Object.keys(result.data).toSorted()).toEqual([
      'exportedAt',
      'format',
      'settings',
      'version',
    ]);
    expect(parseSettingsBackup(result.data).success).toBe(true);
    result.data.settings.preferences.selectedModels.openai = 'changed';
    expect(backup.settings.preferences.selectedModels.openai).toBe(
      'vision-model',
    );
  });

  test('exports an empty account with empty final history', async () => {
    const result = await fixture().useCase.execute(
      settingsBackupFixture().settings.preferences,
    );
    expect(result.success).toBe(true);
    if (!result.success) throw result.error;
    expect(result.data.settings.apiKeys).toEqual([]);
    expect(result.data.settings.activeKeyId).toBeNull();
    expect(result.data.settings.history).toEqual([]);
  });

  test.each(['credentials', 'models', 'providers', 'keys', 'history'] as const)(
    'returns a %s read failure instead of exporting a partial backup',
    async (storage) => {
      const f = fixture();
      const error = StorageError.readFailed(storage);
      if (storage === 'providers') f.providers.failNext(error);
      else f[storage].failNextCallWith(error);
      expect(
        await f.useCase.execute(settingsBackupFixture().settings.preferences),
      ).toEqual({ success: false, error });
    },
  );
});
