import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createSettingsController,
  type SettingsDeps,
} from './SettingsController.svelte';
import type {
  SettingsBackupData,
  SettingsPreferences,
} from '../../../../../../core/domain/settings/SettingsBackup';
import { failure, success } from '../../../../../../shared/types/Result';
import { ValidationError } from '../../../../../../shared/errors';
import type { PopupToastController } from '../../toast/PopupToastController.svelte';

const preferences: SettingsPreferences = {
  theme: 'dark',
  targetLanguage: 'id-ID',
  selectedModels: { google: 'vision' },
  includeDescription: false,
};

const backup: SettingsBackupData = {
  format: 'rosseta-settings',
  version: 1,
  exportedAt: '2026-10-21T00:00:00.000Z',
  settings: {
    apiKeys: [],
    activeKeyId: null,
    preferences,
    customProviders: [],
    models: {},
    history: [],
    keySelection: { mode: 'manual', lastUsedKeyIds: {} },
  },
};

function setup(overrides: Partial<SettingsDeps> = {}) {
  const show = vi.fn();

  const deps: SettingsDeps = {
    exportSettings: { execute: vi.fn().mockResolvedValue(success(backup)) },
    importSettings: { execute: vi.fn().mockResolvedValue(success(undefined)) },
    preferences: () => preferences,
    refresh: vi.fn().mockResolvedValue(undefined),
    toast: { show } as unknown as PopupToastController,
    ...overrides,
  };

  return { controller: createSettingsController(deps), deps, show };
}

function jsonFile(contents: string): File {
  return Object.assign(new File([contents], 'settings.json'), {
    text: vi.fn().mockResolvedValue(contents),
  });
}

describe('Settings controller', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'URL',
      Object.assign(class extends URL {}, {
        createObjectURL: vi.fn().mockReturnValue('blob:settings'),
        revokeObjectURL: vi.fn(),
      }),
    );

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('exports the current preferences and releases its download URL', async () => {
    const { controller, deps, show } = setup();

    await controller.exportSettings();
    expect(deps.exportSettings.execute).toHaveBeenCalledWith(preferences);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:settings');
    expect(controller.busy).toBe(false);

    expect(show).toHaveBeenCalledWith({
      type: 'success',
      message: 'Settings exported',
    });
  });

  test('reports an export failure without creating a download', async () => {
    const { controller, show } = setup({
      exportSettings: {
        execute: vi
          .fn()
          .mockResolvedValue(
            failure(ValidationError.invalidInput('Storage unavailable')),
          ),
      },
    });

    await controller.exportSettings();
    expect(URL.createObjectURL).not.toHaveBeenCalled();

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        description: 'Storage unavailable',
      }),
    );

    expect(controller.busy).toBe(false);
  });

  test('releases the URL and resets exporting when a download throws', async () => {
    const { controller, show } = setup();

    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => {
      throw new Error('Download unavailable');
    });

    await controller.exportSettings();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:settings');
    expect(controller.busy).toBe(false);

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        description: 'Download unavailable',
      }),
    );
  });

  test('rejects malformed JSON before invoking the import action', async () => {
    const { controller, deps, show } = setup();

    await controller.importSettings(jsonFile('{invalid'));
    expect(deps.importSettings.execute).not.toHaveBeenCalled();
    expect(deps.refresh).not.toHaveBeenCalled();

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Choose a valid JSON settings file.',
      }),
    );

    expect(controller.busy).toBe(false);
  });

  test('refreshes popup data only after an accepted import', async () => {
    const { controller, deps, show } = setup();

    await controller.importSettings(jsonFile(JSON.stringify(backup)));
    expect(deps.importSettings.execute).toHaveBeenCalledWith(backup);
    expect(deps.refresh).toHaveBeenCalledOnce();

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        message: 'Settings imported',
      }),
    );

    expect(controller.busy).toBe(false);
  });

  test('leaves popup data alone when the import action fails', async () => {
    const { controller, deps, show } = setup({
      importSettings: {
        execute: vi
          .fn()
          .mockResolvedValue(
            failure(ValidationError.invalidInput('Unsupported backup')),
          ),
      },
    });

    await controller.importSettings(jsonFile('{}'));
    expect(deps.refresh).not.toHaveBeenCalled();

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Unsupported backup' }),
    );

    expect(controller.busy).toBe(false);
  });

  test('reports an already saved import when the popup cannot refresh', async () => {
    const { controller, show } = setup({
      refresh: vi.fn().mockRejectedValue(new Error('Read failed')),
    });

    await controller.importSettings(jsonFile('{}'));

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        description: expect.stringContaining('Settings were saved'),
      }),
    );

    expect(controller.busy).toBe(false);
  });

  test('prevents concurrent imports and exports until the active action finishes', async () => {
    let finish!: (
      value: ReturnType<typeof success<SettingsBackupData>>,
    ) => void;

    const execute = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    const { controller, deps } = setup({ exportSettings: { execute } });
    const exporting = controller.exportSettings();

    expect(controller.busy).toBe(true);
    await controller.exportSettings();
    await controller.importSettings(jsonFile('{}'));
    expect(execute).toHaveBeenCalledOnce();
    expect(deps.importSettings.execute).not.toHaveBeenCalled();
    finish(success(backup));
    await exporting;
    expect(controller.busy).toBe(false);
  });

  test('an unexpected import rejection does not leave the form busy', async () => {
    const { controller, show } = setup({
      importSettings: {
        execute: vi.fn().mockRejectedValue(new Error('Write failed')),
      },
    });

    await controller.importSettings(jsonFile('{}'));
    expect(controller.busy).toBe(false);

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Write failed' }),
    );
  });
});
