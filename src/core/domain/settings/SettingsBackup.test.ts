import { describe, expect, test } from 'bun:test';
import { parseSettingsBackup } from './SettingsBackup';
import { settingsBackupFixture } from '../../../../tests/settings-backup-fixtures';

function withSettings(overrides: Record<string, unknown>): unknown {
  const backup = settingsBackupFixture();

  return { ...backup, settings: { ...backup.settings, ...overrides } };
}

describe('Domain: SettingsBackup', () => {
  test.each([null, {}, 'history', 12])(
    'rejects malformed history rather than interpreting it as an empty replacement: %j',
    (history) => {
      expect(parseSettingsBackup(withSettings({ history })).success).toBe(
        false,
      );
    },
  );

  test.each(['original', 'translated'] as const)(
    'rejects a saved translation with no %s segments',
    (field) => {
      const translation = settingsBackupFixture().settings.history[0]!;

      expect(
        parseSettingsBackup(
          withSettings({ history: [{ ...translation, [field]: [] }] }),
        ).success,
      ).toBe(false);
    },
  );

  test('keeps legitimate version-one history with independently grouped arrays', () => {
    const backup = settingsBackupFixture();
    const translation = backup.settings.history[0]!;

    translation.original.push({
      ...translation.original[0]!,
      text: 'Second source',
      blockIndex: 1,
    });

    const parsed = parseSettingsBackup(backup);

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw parsed.error;
    expect(parsed.data.history?.[0]?.original).toHaveLength(2);
    expect(parsed.data.history?.[0]?.translated).toHaveLength(1);
  });

  test.each([
    undefined,
    null,
    'invalid',
    '2026-10-01',
    '2026-02-31T00:00:00.000Z',
  ])('rejects malformed exported timestamps: %j', (exportedAt) => {
    expect(
      parseSettingsBackup({ ...settingsBackupFixture(), exportedAt }).success,
    ).toBe(false);
  });

  test.each([
    '2026-10-01',
    '2026-02-31T00:00:00.000Z',
    '2026-10-01T24:00:00.000Z',
  ])(
    'rejects history timestamps that normalize to a different date: %s',
    (createdAt) => {
      const translation = settingsBackupFixture().settings.history[0]!;

      expect(
        parseSettingsBackup(
          withSettings({ history: [{ ...translation, createdAt }] }),
        ).success,
      ).toBe(false);
    },
  );

  test.each(['__proto__', 'constructor', 'toString'])(
    'rejects inherited enum values throughout the backup: %s',
    (value) => {
      const backup = settingsBackupFixture();
      const translation = backup.settings.history[0]!;

      expect(
        parseSettingsBackup(
          withSettings({
            preferences: { ...backup.settings.preferences, theme: value },
          }),
        ).success,
      ).toBe(false);

      expect(
        parseSettingsBackup(
          withSettings({
            preferences: {
              ...backup.settings.preferences,
              targetLanguage: value,
            },
          }),
        ).success,
      ).toBe(false);

      expect(
        parseSettingsBackup(
          withSettings({
            history: [
              {
                ...translation,
                original: [
                  { ...translation.original[0]!, languageCode: value },
                ],
              },
            ],
          }),
        ).success,
      ).toBe(false);
    },
  );

  test('rejects unsafe segment block indexes', () => {
    const translation = settingsBackupFixture().settings.history[0]!;

    expect(
      parseSettingsBackup(
        withSettings({
          history: [
            {
              ...translation,
              original: [
                {
                  ...translation.original[0]!,
                  blockIndex: Number.MAX_SAFE_INTEGER + 1,
                },
              ],
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  test('rejects duplicate model IDs after normalization', () => {
    const model = settingsBackupFixture().settings.models.openai![0]!;

    expect(
      parseSettingsBackup(
        withSettings({
          models: { openai: [model, { ...model, id: ` ${model.id} ` }] },
        }),
      ).success,
    ).toBe(false);
  });

  test.each([
    {
      apiKeys: [{ id: 'orphan', provider: 'custom-missing', apiKey: 'value' }],
    },
    { models: { 'custom-missing': [] } },
    {
      preferences: {
        ...settingsBackupFixture().settings.preferences,
        selectedModels: { 'custom-missing': 'model' },
      },
    },
    {
      keySelection: {
        mode: 'manual',
        lastUsedKeyIds: { 'custom-missing': 'orphan' },
      },
    },
  ])(
    'rejects unknown provider references instead of silently deleting entries: %j',
    (settings) => {
      expect(parseSettingsBackup(withSettings(settings)).success).toBe(false);
    },
  );

  test.each([
    { activeKeyId: 'missing' },
    { keySelection: { mode: 'manual', lastUsedKeyIds: { openai: 'missing' } } },
    { keySelection: { mode: 'manual', lastUsedKeyIds: { google: 'key-1' } } },
    { keySelection: { mode: 'auto-balance:openai', lastUsedKeyIds: {} } },
    {
      keySelection: { mode: 'auto-balance:custom-missing', lastUsedKeyIds: {} },
    },
  ])(
    'rejects dangling active, cursor and auto-balance references: %j',
    (settings) => {
      expect(parseSettingsBackup(withSettings(settings)).success).toBe(false);
    },
  );

  test('preserves a valid auto-balance selection and cursor', () => {
    const backup = settingsBackupFixture();

    backup.settings.apiKeys.push({
      id: 'key-2',
      provider: 'openai',
      apiKey: 'other-key',
    });

    backup.settings.keySelection.mode = 'auto-balance:openai';

    const parsed = parseSettingsBackup(backup);

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw parsed.error;
    expect(parsed.data.keySelectionMode.value).toBe('auto-balance:openai');
    expect(parsed.data.lastUsedKeyIds).toEqual({ openai: 'key-1' });
  });

  test('rejects a blank selected model instead of dropping the selection', () => {
    const preferences = settingsBackupFixture().settings.preferences;

    expect(
      parseSettingsBackup(
        withSettings({
          preferences: { ...preferences, selectedModels: { openai: ' ' } },
        }),
      ).success,
    ).toBe(false);
  });

  test('preserves literal prototype-like header and query keys during parsing', () => {
    const backup = settingsBackupFixture();

    backup.settings.customProviders.push({
      id: 'custom-literal',
      name: 'Literal keys',
      baseURL: 'https://example.com/v1',
      headers: JSON.parse(
        '{"__proto__":"header-value","constructor":"header-constructor"}',
      ),
      queryParams: JSON.parse(
        '{"__proto__":"query-value","toString":"query-string"}',
      ),
    });

    const parsed = parseSettingsBackup(backup);

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw parsed.error;

    const props = parsed.data.customProviders[0]!.toProps();

    expect(Object.hasOwn(props.headers!, '__proto__')).toBe(true);
    expect(props.headers!.__proto__).toBe('header-value');
    expect(Object.hasOwn(props.queryParams!, '__proto__')).toBe(true);
    expect(props.queryParams!.__proto__).toBe('query-value');
    expect(Object.getPrototypeOf(props.headers)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(props.queryParams)).toBe(Object.prototype);
  });

  test('rejects objects with inherited backup fields', () => {
    expect(
      parseSettingsBackup(Object.create(settingsBackupFixture())).success,
    ).toBe(false);
  });

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
