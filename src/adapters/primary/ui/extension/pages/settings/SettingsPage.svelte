<script lang="ts">
  import {
    getAuthStateContext,
    getCustomProvidersStateContext,
    getModelsStateContext,
    getPopupToastContext,
    getPreferencesStateContext,
    getSettingsContext,
  } from '../../context';
  import { PageShell } from '../../../shared/components';
  import { createSettingsController } from './SettingsController.svelte';
  import SettingsBackupForm from './SettingsBackupForm.svelte';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();

  const auth = getAuthStateContext();
  const preferences = getPreferencesStateContext();
  const models = getModelsStateContext();
  const customProviders = getCustomProvidersStateContext();
  const settings = getSettingsContext();
  const toast = getPopupToastContext();

  const controller = createSettingsController({
    exportSettings: settings.exportSettings,
    importSettings: settings.importSettings,
    preferences: () => ({
      theme: preferences.state.theme.value,
      targetLanguage: preferences.state.targetLanguage.code,
      selectedModels: { ...preferences.state.selectedModels },
      includeDescription: preferences.state.includeDescription,
    }),
    refresh: async () => {
      const providersResult = await customProviders.hydrate();

      if (!providersResult.success) throw providersResult.error;

      const results = await Promise.all([
        auth.hydrate(),
        preferences.hydrate(),
        models.hydrate(),
      ]);

      for (const result of results) {
        if (!result.success) throw result.error;
      }
    },
    toast,
  });
</script>

<PageShell
  {onback}
  title="Settings"
  isDark={preferences.state.resolvedTheme === 'dark'}
  onToggleTheme={preferences.toggleTheme}
>
  <SettingsBackupForm
    exporting={controller.state.isExporting}
    importing={controller.state.isImporting}
    onexport={controller.exportSettings}
    onimport={controller.importSettings}
  />
</PageShell>
