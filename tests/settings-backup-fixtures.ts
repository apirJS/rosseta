import type { SettingsBackupData } from '../src/core/domain/settings/SettingsBackup';

/** Version-one backups retain domain history, independently of the model wire schema. */
export function settingsBackupFixture(): SettingsBackupData {
  return {
    format: 'rosseta-settings',
    version: 1,
    exportedAt: '2026-10-10T00:00:00.000Z',
    settings: {
      apiKeys: [{ id: 'key-1', provider: 'openai', apiKey: 'test-key' }],
      activeKeyId: 'key-1',
      preferences: {
        theme: 'dark',
        targetLanguage: 'en-US',
        selectedModels: { openai: 'vision-model' },
        includeDescription: true,
      },
      customProviders: [],
      models: {
        openai: [
          { id: 'vision-model', name: 'Vision model', source: 'manual' },
        ],
      },
      history: [
        {
          id: 'history-1',
          original: [
            {
              text: '\u3053\u3093\u306b\u3061\u306f',
              languageCode: 'ja-JP',
              languageName: 'Japanese',
              romanization: 'konnichiwa',
              blockIndex: 0,
            },
          ],
          translated: [
            {
              text: 'Hello',
              languageCode: 'en-US',
              languageName: 'English',
              romanization: null,
              blockIndex: 0,
            },
          ],
          description: 'A greeting',
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      keySelection: { mode: 'manual', lastUsedKeyIds: { openai: 'key-1' } },
    },
  };
}
