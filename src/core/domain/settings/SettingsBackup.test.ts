import { describe, expect, test } from 'bun:test';
import { parseSettingsBackup } from './SettingsBackup';
import { settingsBackupFixture } from '../../../../tests/settings-backup-fixtures';

describe('Domain: SettingsBackup', () => {
  test('accepts existing version-one history without a paired-segment response migration', () => {
    const backup = settingsBackupFixture();
    const result = parseSettingsBackup(JSON.parse(JSON.stringify(backup)));

    expect(result.success).toBe(true);
    if (!result.success) throw result.error;

    expect(
      result.data.history?.map((translation) => translation.toProps()),
    ).toEqual(backup.settings.history);

    expect(result.data.credentials.getActive()?.id).toBe('key-1');
    expect(result.data.preferences).toEqual(backup.settings.preferences);
  });

  test('keeps history absent in old backups distinct from an explicit empty history', () => {
    const backup = settingsBackupFixture();
    const { history: _history, ...settings } = backup.settings;
    const old = parseSettingsBackup({ ...backup, settings });

    const empty = parseSettingsBackup({
      ...backup,
      settings: { ...settings, history: [] },
    });

    expect(old.success && old.data.history).toBeNull();
    expect(empty.success && empty.data.history).toEqual([]);
  });

  test('ignores imported operational capability facts instead of making them settings', () => {
    const backup = settingsBackupFixture();

    const result = parseSettingsBackup({
      ...backup,
      translationCapabilitiesV1: { unsafe: 'root facts' },
      settings: {
        ...backup.settings,
        translationCapabilitiesV1: { unsafe: 'settings facts' },
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) throw result.error;

    expect(Object.keys(result.data).toSorted()).toEqual([
      'credentials',
      'customProviders',
      'history',
      'keySelectionMode',
      'lastUsedKeyIds',
      'models',
      'preferences',
    ]);
  });

  test.each([
    { format: 'other', version: 1 },
    { format: 'rosseta-settings', version: 2 },
  ])(
    'rejects unsupported backup formats before importing any data',
    (format) => {
      expect(
        parseSettingsBackup({ ...settingsBackupFixture(), ...format }).success,
      ).toBe(false);
    },
  );

  test('rejects partial model output masquerading as saved history', () => {
    const backup = settingsBackupFixture();

    const result = parseSettingsBackup({
      ...backup,
      settings: {
        ...backup.settings,
        history: [{ segments: [{ originalText: 'Hel' }] }],
      },
    });

    expect(result.success).toBe(false);
  });

  test('rejects invalid legacy history metadata and duplicate IDs', () => {
    const backup = settingsBackupFixture();
    const translation = backup.settings.history[0]!;

    for (const history of [
      [{ ...translation, createdAt: 'invalid' }],
      [translation, translation],
      [
        {
          ...translation,
          original: [{ ...translation.original[0]!, blockIndex: -1 }],
        },
      ],
    ]) {
      expect(
        parseSettingsBackup({
          ...backup,
          settings: { ...backup.settings, history },
        }).success,
      ).toBe(false);
    }
  });
});
