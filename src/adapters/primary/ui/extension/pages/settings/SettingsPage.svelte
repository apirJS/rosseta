<script lang="ts">
  import {
    getAuthStateContext,
    getCustomProvidersStateContext,
    getModelsStateContext,
    getPopupToastContext,
    getPreferencesStateContext,
    getSettingsContext,
  } from '../../../shared/context';
  import { PageShell } from '../../../shared/components';
  import { createSettingsController } from './SettingsController.svelte';

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
  let fileInput: HTMLInputElement | undefined;

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
      await customProviders.hydrate();
      await Promise.all([
        auth.hydrate(),
        preferences.hydrate(),
        models.hydrate(),
      ]);
    },
    toast,
  });

  async function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await controller.importSettings(file);
    input.value = '';
  }
</script>

<PageShell
  {onback}
  title="Settings"
  isDark={preferences.state.resolvedTheme === 'dark'}
  onToggleTheme={preferences.toggleTheme}
>
  <div class="flex-1 overflow-y-auto flex flex-col gap-3">
    <section class="rounded-lg border border-border bg-surface p-4">
      <h3 class="text-sm font-semibold text-foreground">Export Settings</h3>
      <p class="mt-1 text-xs leading-relaxed text-muted">
        Download a JSON backup containing API keys, custom providers, models,
        language and model preferences, theme, key rotation settings, and
        translation history.
      </p>
      <button
        type="button"
        class="mt-3 w-full px-3 py-2 rounded-lg bg-primary text-primary-fg text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50"
        disabled={controller.state.isExporting || controller.state.isImporting}
        onclick={() => controller.exportSettings()}
      >
        {controller.state.isExporting ? 'Exporting…' : 'Export Settings'}
      </button>
    </section>

    <section class="rounded-lg border border-border bg-surface p-4">
      <h3 class="text-sm font-semibold text-foreground">Import Settings</h3>
      <p class="mt-1 text-xs leading-relaxed text-muted">
        Restore a Rosseta JSON backup. Imported values replace your current API
        keys, custom providers, models, preferences, and translation history.
      </p>
      <input
        bind:this={fileInput}
        class="hidden"
        type="file"
        accept="application/json,.json"
        onchange={handleFileChange}
      />
      <button
        type="button"
        class="mt-3 w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm font-medium text-foreground hover:bg-background cursor-pointer disabled:opacity-50"
        disabled={controller.state.isExporting || controller.state.isImporting}
        onclick={() => fileInput?.click()}
      >
        {controller.state.isImporting ? 'Importing…' : 'Import Settings'}
      </button>
    </section>

    <p class="px-1 text-xs leading-relaxed text-muted">
      Settings files contain your API keys in plain text. Store them somewhere
      private.
    </p>
  </div>
</PageShell>
