import type { IExportSettingsUseCase } from '../../../../../../core/ports/inbound/settings/IExportSettingsUseCase';
import type { IImportSettingsUseCase } from '../../../../../../core/ports/inbound/settings/IImportSettingsUseCase';
import type { SettingsPreferences } from '../../../../../../core/domain/settings/SettingsBackup';
import type { PopupToastController } from '../../../shared/toast/PopupToastController.svelte';

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

  async function exportSettings() {
    state.isExporting = true;
    const result = await deps.exportSettings.execute(deps.preferences());
    state.isExporting = false;

    if (!result.success) {
      deps.toast.show({
        type: 'error',
        message: 'Could not export settings',
        description: result.error.message,
      });
      return;
    }

    const blob = new Blob([JSON.stringify(result.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rosseta-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    deps.toast.show({ type: 'success', message: 'Settings exported' });
  }

  async function importSettings(file: File) {
    state.isImporting = true;
    let data: unknown;
    try {
      data = JSON.parse(await file.text()) as unknown;
    } catch {
      state.isImporting = false;
      deps.toast.show({
        type: 'error',
        message: 'Could not import settings',
        description: 'Choose a valid JSON settings file.',
      });
      return;
    }

    const result = await deps.importSettings.execute(data);
    if (!result.success) {
      state.isImporting = false;
      deps.toast.show({
        type: 'error',
        message: 'Could not import settings',
        description: result.error.message,
      });
      return;
    }

    await deps.refresh();
    state.isImporting = false;
    deps.toast.show({
      type: 'success',
      message: 'Settings imported',
      description: 'Your settings and translation history are now active.',
    });
  }

  return {
    state,
    exportSettings,
    importSettings,
  };
}
