import { describe, expect, test } from 'bun:test';
import { ImportSettingsUseCase } from './ImportSettingsUseCase';
import { parseSettingsBackup } from '../../domain/settings/SettingsBackup';
import { FakeSettingsBackupStorage } from '../../../../tests/fakes/FakeSettingsBackupStorage';
import { settingsBackupFixture } from '../../../../tests/settings-backup-fixtures';
import { ErrorCode, StorageError } from '../../../shared/errors';

function fixture() {
  const backup = settingsBackupFixture();
  const parsed = parseSettingsBackup(backup);

  if (!parsed.success) throw parsed.error;

  const storage = new FakeSettingsBackupStorage(parsed.data);

  return { backup, storage, useCase: new ImportSettingsUseCase(storage) };
}

describe('Application: ImportSettingsUseCase', () => {
  test('validates and replaces the complete settings once without operational state', async () => {
    const { backup, storage, useCase } = fixture();

    const result = await useCase.execute({
      ...backup,
      settings: {
        ...backup.settings,
        translationCapabilitiesV1: { facts: 'untrusted' },
      },
    });

    expect(result.success).toBe(true);
    expect(storage.replacements).toHaveLength(1);

    expect(
      Object.hasOwn(storage.replacements[0]!, 'translationCapabilitiesV1'),
    ).toBe(false);

    expect(storage.settings.credentials.getActive()?.id).toBe('key-1');

    expect(storage.settings.history?.map((entry) => entry.toProps())).toEqual(
      backup.settings.history,
    );
  });

  test('does not write anything for malformed backup data', async () => {
    const { backup, storage, useCase } = fixture();

    const result = await useCase.execute({
      ...backup,
      settings: { ...backup.settings, history: null },
    });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.VALIDATION_INVALID_INPUT);
    expect(storage.replacements).toEqual([]);
  });

  test('preserves the distinction between omitted and explicitly empty history', async () => {
    const { backup, storage, useCase } = fixture();
    const { history: _history, ...settings } = backup.settings;

    expect((await useCase.execute({ ...backup, settings })).success).toBe(true);
    expect(storage.replacements[0]!.history).toBeNull();
    expect(storage.settings.history).toHaveLength(1);

    expect(
      (
        await useCase.execute({
          ...backup,
          settings: { ...settings, history: [] },
        })
      ).success,
    ).toBe(true);

    expect(storage.settings.history).toEqual([]);
  });

  test('propagates replacement failure without reporting success', async () => {
    const { backup, storage, useCase } = fixture();
    const error = StorageError.writeFailed('settings');

    storage.error = error;
    expect(await useCase.execute(backup)).toEqual({ success: false, error });
    expect(storage.replacements).toEqual([]);
  });

  test('converts rejected writes into an application error', async () => {
    const { backup, storage, useCase } = fixture();

    storage.replace = async () => {
      throw new Error('write failed');
    };

    expect((await useCase.execute(backup)).success).toBe(false);
  });
});
