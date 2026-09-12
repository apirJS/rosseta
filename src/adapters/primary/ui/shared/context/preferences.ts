import { getContext, setContext } from 'svelte';
import type { IGetPreferencesUseCase } from '../../../../../core/ports/inbound/preferences/IGetPreferencesUseCase';
import type { IUpdatePreferencesUseCase } from '../../../../../core/ports/inbound/preferences/IUpdatePreferencesUseCase';
import type { IGetShortcutUseCase } from '../../../../../core/ports/inbound/command/IGetShortcutUseCase';

const PREFERENCES_CONTEXT_KEY = Symbol('preferences');
const PREFERENCES_STATE_KEY = Symbol('preferencesState');

export interface PreferencesUseCases {
  getPreferences: IGetPreferencesUseCase;
  updatePreferences: IUpdatePreferencesUseCase;
  getShortcut: IGetShortcutUseCase;
  onThemeApplied?: (theme: 'dark' | 'light') => void;
}

export type PreferencesStateContext = ReturnType<
  typeof import('../hooks/usePreferences.svelte').usePreferences
>;

export function setPreferencesContext(useCases: PreferencesUseCases): void {
  setContext(PREFERENCES_CONTEXT_KEY, useCases);
}

export function getPreferencesContext(): PreferencesUseCases {
  const context = getContext<PreferencesUseCases>(PREFERENCES_CONTEXT_KEY);
  if (!context) {
    throw new Error(
      'Preferences context not found. Did you forget to call setPreferencesContext?',
    );
  }
  return context;
}

export function setPreferencesStateContext(
  preferences: PreferencesStateContext,
): void {
  setContext(PREFERENCES_STATE_KEY, preferences);
}

export function getPreferencesStateContext(): PreferencesStateContext {
  const context = getContext<PreferencesStateContext>(PREFERENCES_STATE_KEY);
  if (!context) {
    throw new Error(
      'Preferences state context not found. Did you forget to call setPreferencesStateContext?',
    );
  }
  return context;
}
