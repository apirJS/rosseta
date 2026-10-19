import { describe, expect, test } from 'bun:test';
import { ImportSettingsUseCase } from './ImportSettingsUseCase';
import { parseSettingsBackup } from '../../domain/settings/SettingsBackup';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { FakeUserPreferencesStorage } from '../../../../tests/fakes/FakeUserPreferencesStorage';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { FakeCustomProviderStorage } from '../../../../tests/fakes/FakeCustomProviderStorage';
import { FakeKeySelectionStorage } from '../../../../tests/fakes/FakeKeySelectionStorage';
import { FakeTranslationStorage } from '../../../../tests/fakes/FakeTranslationStorage';
import { settingsBackupFixture } from '../../../../tests/settings-backup-fixtures';
import { ErrorCode, StorageError } from '../../../shared/errors';

function fixture() {
  const credentials = new FakeCredentialStorage();
  const preferences = new FakeUserPreferencesStorage();
  const models = new FakeModelStorage();
  const providers = new FakeCustomProviderStorage();
  const keys = new FakeKeySelectionStorage();
  const history = new FakeTranslationStorage();
  const useCase = new ImportSettingsUseCase(
    credentials,
    preferences,
    models,
    providers,
    keys,
    history,
  );
  return {
    credentials,
    preferences,
    models,
    providers,
    keys,
    history,
    useCase,
  };
}

describe('Application: ImportSettingsUseCase', () => {
  test('restores existing domain history and settings without importing capability state', async () => {
    const backup = settingsBackupFixture();
    const f = fixture();
    const result = await f.useCase.execute({
      ...backup,
      settings: {
        ...backup.settings,
        translationCapabilitiesV1: { facts: 'untrusted backup knowledge' },
      },
    });
    expect(result.success).toBe(true);
    const history = await f.history.getAll();
    expect(
      history.success &&
        history.data.map((translation) => translation.toProps()),
    ).toEqual(backup.settings.history);
    const credentials = await f.credentials.get();
    expect(credentials.success && credentials.data?.getActive()?.id).toBe(
      'key-1',
    );
    expect(f.preferences.setCalls).toEqual([backup.settings.preferences]);
    expect(f.models.getStoredModels('openai')).toEqual(
      backup.settings.models.openai!,
    );
    expect(await f.keys.getLastUsedId('openai')).toEqual({
      success: true,
      data: 'key-1',
    });
  });

  test('preserves stored history when an older backup omits it and clears it when explicitly empty', async () => {
    const backup = settingsBackupFixture();
    const parsed = parseSettingsBackup(backup);
    if (!parsed.success) throw parsed.error;
    const f = fixture();
    f.history.seed(parsed.data.history![0]!);
    const { history: _history, ...settings } = backup.settings;
    expect((await f.useCase.execute({ ...backup, settings })).success).toBe(
      true,
    );
    expect(f.history.storedCount).toBe(1);
    expect(
      (
        await f.useCase.execute({
          ...backup,
          settings: { ...settings, history: [] },
        })
      ).success,
    ).toBe(true);
    expect(f.history.storedCount).toBe(0);
  });

  test('rejects invalid history before mutating settings', async () => {
    const backup = settingsBackupFixture();
    const f = fixture();
    const result = await f.useCase.execute({
      ...backup,
      settings: { ...backup.settings, history: [{ segments: [] }] },
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.VALIDATION_INVALID_INPUT);
    expect(f.preferences.setCalls).toEqual([]);
    expect(f.history.storedCount).toBe(0);
    expect(await f.credentials.get()).toEqual({ success: true, data: null });
  });

  test.each([
    'credentials',
    'preferences',
    'models',
    'providers',
    'keys',
    'history',
  ] as const)('returns a %s persistence failure', async (storage) => {
    const f = fixture();
    const error = StorageError.writeFailed(storage);
    if (storage === 'providers') f.providers.failNext(error);
    else f[storage].failNextCallWith(error);
    expect(await f.useCase.execute(settingsBackupFixture())).toEqual({
      success: false,
      error,
    });
  });
});
