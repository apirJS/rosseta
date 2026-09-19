import { getContext, setContext } from 'svelte';
import type { IExportSettingsUseCase } from '../../../../../core/ports/inbound/settings/IExportSettingsUseCase';
import type { IImportSettingsUseCase } from '../../../../../core/ports/inbound/settings/IImportSettingsUseCase';

const SETTINGS_CONTEXT_KEY = Symbol('settings');

export interface SettingsUseCases {
  exportSettings: IExportSettingsUseCase;
  importSettings: IImportSettingsUseCase;
}

export function setSettingsContext(useCases: SettingsUseCases): void {
  setContext(SETTINGS_CONTEXT_KEY, useCases);
}

export function getSettingsContext(): SettingsUseCases {
  const context = getContext<SettingsUseCases>(SETTINGS_CONTEXT_KEY);
  if (!context) {
    throw new Error(
      'Settings context not found. Did you forget to call setSettingsContext?',
    );
  }
  return context;
}
