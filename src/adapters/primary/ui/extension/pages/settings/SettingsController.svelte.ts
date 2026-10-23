import type { IExportSettingsUseCase } from '../../../../../../core/ports/inbound/settings/IExportSettingsUseCase';
import type { IImportSettingsUseCase } from '../../../../../../core/ports/inbound/settings/IImportSettingsUseCase';
import type {
  SettingsBackupData,
  SettingsPreferences,
} from '../../../../../../core/domain/settings/SettingsBackup';
import type { PopupToastController } from '../../toast/PopupToastController.svelte';

class SettingsState {
  isExporting = $state(false);
  isImporting = $state(false);
}

export interface SettingsDeps {
  exportSettings: IExportSettingsUseCase;
  importSettings: IImportSettingsUseCase;
  preferences: () => SettingsPreferences;
  refresh: () => Promise<void>;
  toast: PopupToastController;
}

export function createSettingsController(deps: SettingsDeps) {
  const state = new SettingsState();
  const busy = $derived(state.isExporting || state.isImporting);

  async function exportSettings() {
    if (busy) return;
    state.isExporting = true;

    try {
      const result = await deps.exportSettings.execute(deps.preferences());

      if (!result.success) {
        showError('export', result.error.message);

        return;
      }

      downloadBackup(result.data);
      deps.toast.show({ type: 'success', message: 'Settings exported' });
    } catch (error) {
      showError(
        'export',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      state.isExporting = false;
    }
  }

  async function importSettings(file: File) {
    if (busy) return;
    state.isImporting = true;

    try {
      let data: unknown;

      try {
        data = JSON.parse(await file.text()) as unknown;
      } catch {
        showError('import', 'Choose a valid JSON settings file.');

        return;
      }

      const result = await deps.importSettings.execute(data);

      if (!result.success) {
        showError('import', result.error.message);

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

      deps.toast.show({
        type: 'success',
        message: 'Settings imported',
        description: 'Your settings and translation history are now active.',
      });
    } catch (error) {
      showError(
        'import',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      state.isImporting = false;
    }
  }

  function showError(action: 'export' | 'import', description: string) {
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
  };
}

function downloadBackup(backup: SettingsBackupData) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');

    link.href = url;
    link.download = `rosseta-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
