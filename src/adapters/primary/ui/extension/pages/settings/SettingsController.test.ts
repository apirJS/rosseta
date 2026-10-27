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
import {
  AppError,
  ErrorCode,
  ValidationError,
} from '../../../../../../shared/errors';
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

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });

  return { promise, resolve };
}

describe('Settings controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();

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
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('exports persisted settings and keeps the URL alive until the download starts', async () => {
    const { controller, deps, show } = setup();

    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.isConnected).toBe(true);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    await controller.exportSettings();
    expect(deps.exportSettings.execute).toHaveBeenCalledWith();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
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
        description: 'An unexpected error occurred.',
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
      expect.objectContaining({ description: 'An unexpected error occurred.' }),
    );
  });

  test('accepts a UTF-8 byte order mark before JSON', async () => {
    const { controller, deps } = setup();

    await controller.importSettings(
      jsonFile('\uFEFF' + JSON.stringify(backup)),
    );

    expect(deps.importSettings.execute).toHaveBeenCalledWith(backup);
    expect(deps.refresh).toHaveBeenCalledOnce();
  });

  test('distinguishes a file read failure from malformed JSON', async () => {
    const { controller, deps, show } = setup();
    const file = jsonFile('{}');

    vi.mocked(file.text).mockRejectedValue(new Error('File unavailable'));
    await controller.importSettings(file);
    expect(deps.importSettings.execute).not.toHaveBeenCalled();

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Could not read the selected file. Choose it again.',
      }),
    );

    expect(controller.busy).toBe(false);
  });

  test.each(['import', 'export'] as const)(
    'uses safe %s failure text instead of technical diagnostics',
    async (action) => {
      const error = new AppError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'private storage details',
        userMessage: 'Safe failure text',
      });

      const { controller, deps, show } = setup();

      if (action === 'import') {
        vi.mocked(deps.importSettings.execute).mockResolvedValue(
          failure(error),
        );

        await controller.importSettings(jsonFile('{}'));
      } else {
        vi.mocked(deps.exportSettings.execute).mockResolvedValue(
          failure(error),
        );

        await controller.exportSettings();
      }

      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Safe failure text' }),
      );
    },
  );

  test('does not start an import if the page closes while reading its file', async () => {
    const reading = deferred<string>();
    const file = jsonFile('{}');
    const { controller, deps, show } = setup();

    vi.mocked(file.text).mockReturnValue(reading.promise);

    const importing = controller.importSettings(file);

    controller.dispose();
    reading.resolve(JSON.stringify(backup));
    await importing;
    expect(deps.importSettings.execute).not.toHaveBeenCalled();
    expect(deps.refresh).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
    expect(controller.busy).toBe(false);
  });

  test('finishes an already submitted import without refreshing or announcing after disposal', async () => {
    const saving = deferred<ReturnType<typeof success<void>>>();

    const { controller, deps, show } = setup({
      importSettings: { execute: vi.fn().mockReturnValue(saving.promise) },
    });

    const importing = controller.importSettings(jsonFile('{}'));

    await vi.waitFor(() =>
      expect(deps.importSettings.execute).toHaveBeenCalledOnce(),
    );

    controller.dispose();
    saving.resolve(success(undefined));
    await importing;
    expect(deps.refresh).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  test('does not announce a refresh that finishes after leaving the page', async () => {
    const refreshing = deferred<void>();

    const { controller, deps, show } = setup({
      refresh: vi.fn().mockReturnValue(refreshing.promise),
    });

    const importing = controller.importSettings(jsonFile('{}'));

    await vi.waitFor(() => expect(deps.refresh).toHaveBeenCalledOnce());
    controller.dispose();
    refreshing.resolve();
    await importing;
    expect(show).not.toHaveBeenCalled();
  });

  test('does not download an export that finishes after leaving the page', async () => {
    const exporting =
      deferred<ReturnType<typeof success<SettingsBackupData>>>();

    const { controller, show } = setup({
      exportSettings: { execute: vi.fn().mockReturnValue(exporting.promise) },
    });

    const pending = controller.exportSettings();

    controller.dispose();
    exporting.resolve(success(backup));
    await pending;
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  test('disposed controllers reject new import and export actions', async () => {
    const { controller, deps } = setup();
    const file = jsonFile('{}');

    controller.dispose();
    controller.dispose();
    await controller.importSettings(file);
    await controller.exportSettings();
    expect(file.text).not.toHaveBeenCalled();
    expect(deps.importSettings.execute).not.toHaveBeenCalled();
    expect(deps.exportSettings.execute).not.toHaveBeenCalled();
  });
});
