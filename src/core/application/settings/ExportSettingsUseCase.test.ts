import { describe, expect, test } from 'bun:test';
import { ExportSettingsUseCase } from './ExportSettingsUseCase';
import { parseSettingsBackup } from '../../domain/settings/SettingsBackup';
import { FakeSettingsBackupStorage } from '../../../../tests/fakes/FakeSettingsBackupStorage';
import { settingsBackupFixture } from '../../../../tests/settings-backup-fixtures';
import { StorageError } from '../../../shared/errors';

function fixture() {
  const backup = settingsBackupFixture();
  const parsed = parseSettingsBackup(backup);

  if (!parsed.success) throw parsed.error;

  const storage = new FakeSettingsBackupStorage(parsed.data);

  return { backup, storage, useCase: new ExportSettingsUseCase(storage) };
}

describe('Application: ExportSettingsUseCase', () => {
  test('exports one persisted snapshot in the unchanged version-one format', async () => {
    const { backup, storage, useCase } = fixture();
    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (!result.success) throw result.error;
    expect(storage.readCalls).toBe(1);
    expect(result.data.settings).toEqual(backup.settings);

    expect(Object.keys(result.data).toSorted()).toEqual([
      'exportedAt',
      'format',
      'settings',
      'version',
    ]);

    expect(
      parseSettingsBackup(JSON.parse(JSON.stringify(result.data))).success,
    ).toBe(true);

    result.data.settings.models.openai![0]!.name = 'Changed';
    result.data.settings.preferences.selectedModels.openai = 'changed';
    result.data.settings.keySelection.lastUsedKeyIds.openai = 'changed';
    expect(storage.settings.models.openai![0]!.name).toBe('Vision model');

    expect(storage.settings.preferences.selectedModels.openai).toBe(
      'vision-model',
    );

    expect(storage.settings.lastUsedKeyIds.openai).toBe('key-1');
  });

  test('returns snapshot read failures without exporting partial data', async () => {
    const { storage, useCase } = fixture();
    const error = StorageError.readFailed('settings');

    storage.error = error;
    expect(await useCase.execute()).toEqual({ success: false, error });
  });

  test('converts rejected reads into an application error', async () => {
    const { storage, useCase } = fixture();

    storage.read = async () => {
      throw new Error('read failed');
    };

    expect((await useCase.execute()).success).toBe(false);
  });
});
