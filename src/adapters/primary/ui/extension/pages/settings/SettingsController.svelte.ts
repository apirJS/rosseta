import type { IExportSettingsUseCase } from '../../../../../../core/ports/inbound/settings/IExportSettingsUseCase';
import type { IImportSettingsUseCase } from '../../../../../../core/ports/inbound/settings/IImportSettingsUseCase';
import type { SettingsBackupData } from '../../../../../../core/domain/settings/SettingsBackup';
import type { PopupToastController } from '../../toast/PopupToastController.svelte';
import { AppError } from '../../../../../../shared/errors';

const DOWNLOAD_URL_LIFETIME_MS = 1000;

class SettingsState {
  isExporting = $state(false);
  isImporting = $state(false);
}

export interface SettingsDeps {
  exportSettings: IExportSettingsUseCase;
  importSettings: IImportSettingsUseCase;
  refresh: () => Promise<void>;
  toast: PopupToastController;
}

export function createSettingsController(deps: SettingsDeps) {
  const state = new SettingsState();
  const busy = $derived(state.isExporting || state.isImporting);
  let disposed = false;

  async function exportSettings() {
    if (disposed || busy) return;
    state.isExporting = true;

    try {
      const result = await deps.exportSettings.execute();

      if (disposed) return;

      if (!result.success) {
        showError('export', result.error.userMessage);

        return;
      }

      downloadBackup(result.data);
      deps.toast.show({ type: 'success', message: 'Settings exported' });
    } catch (error) {
      showError('export', AppError.fromUnknown(error).userMessage);
    } finally {
      state.isExporting = false;
    }
  }

  async function importSettings(file: File) {
    if (disposed || busy) return;
    state.isImporting = true;

    try {
      let contents: string;

      try {
        contents = await file.text();
      } catch {
        showError(
          'import',
          'Could not read the selected file. Choose it again.',
        );

        return;
      }

      if (disposed) return;

      let data: unknown;

      try {
        data = JSON.parse(contents.replace(/^\uFEFF/, '')) as unknown;
      } catch {
        showError('import', 'Choose a valid JSON settings file.');

        return;
      }

      const result = await deps.importSettings.execute(data);

      if (disposed) return;

      if (!result.success) {
        showError('import', result.error.userMessage);

        return;
      }

      try {
        await deps.refresh();
      } catch {
        showError(
          'import',
          'Settings were saved, but the popup could not refresh. Reopen the popup to load them.',
        );

        return;
      }

      if (disposed) return;

      deps.toast.show({
        type: 'success',
        message: 'Settings imported',
        description: 'Your imported settings are now active.',
      });
    } catch (error) {
      showError('import', AppError.fromUnknown(error).userMessage);
    } finally {
      state.isImporting = false;
    }
  }

  function showError(action: 'export' | 'import', description: string) {
    if (disposed) return;

    deps.toast.show({
      type: 'error',
      message: `Could not ${action} settings`,
      description,
    });
  }

  return {
    state,
    get busy() {
      return busy;
    },
    exportSettings,
    importSettings,
    dispose() {
      disposed = true;
    },
  };
}

function downloadBackup(backup: SettingsBackupData) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  let started = false;

  try {
    link.href = url;
    link.download = `rosseta-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    started = true;
  } finally {
    link.remove();

    if (started) {
      setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
    } else {
      URL.revokeObjectURL(url);
    }
  }
}
