<script lang="ts">
  import { onMount } from 'svelte';
  import {
    setAuthContext,
    setAuthStateContext,
    setPreferencesContext,
    setPreferencesStateContext,
    setTranslationContext,
    setModelsContext,
    setModelsStateContext,
    setCustomProvidersContext,
    setCustomProvidersStateContext,
    setPopupToastContext,
    setSettingsContext,
    type AuthUseCases,
    type PreferencesUseCases,
    type TranslationUseCases,
    type ModelUseCases,
    type CustomProviderUseCases,
    type SettingsUseCases,
  } from './context';
  import { useAuth } from './state/useAuth.svelte';
  import { usePreferences } from './state/usePreferences.svelte';
  import { useModels } from './state/useModels.svelte';
  import { useCustomProviders } from './state/useCustomProviders.svelte';
  import PopupToastContainer from './toast/PopupToastContainer.svelte';
  import { PopupToastController } from './toast/PopupToastController.svelte';
  import PopupRouter from './PopupRouter.svelte';
  import { createPopupInitializationController } from './PopupInitializationController.svelte';

  interface Props {
    authUseCases: AuthUseCases;
    preferencesUseCases: PreferencesUseCases;
    translationUseCases: TranslationUseCases;
    modelUseCases: ModelUseCases;
    customProviderUseCases: CustomProviderUseCases;
    settingsUseCases: SettingsUseCases;
  }

  const {
    authUseCases,
    preferencesUseCases,
    translationUseCases,
    modelUseCases,
    customProviderUseCases,
    settingsUseCases,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  setAuthContext(authUseCases);
  // svelte-ignore state_referenced_locally
  setPreferencesContext(preferencesUseCases);
  // svelte-ignore state_referenced_locally
  setTranslationContext(translationUseCases);
  // svelte-ignore state_referenced_locally
  setModelsContext(modelUseCases);
  // svelte-ignore state_referenced_locally
  setCustomProvidersContext(customProviderUseCases);
  // svelte-ignore state_referenced_locally
  setSettingsContext(settingsUseCases);

  // svelte-ignore state_referenced_locally
  const feedback = new PopupToastController();

  // svelte-ignore state_referenced_locally
  const preferences = usePreferences(preferencesUseCases);

  const auth = useAuth();
  const models = useModels();
  const customProviders = useCustomProviders();

  setPopupToastContext(feedback);

  setAuthStateContext(auth);

  setPreferencesStateContext(preferences);

  setModelsStateContext(models);

  setCustomProvidersStateContext(customProviders);

  const initialization = createPopupInitializationController({
    auth,
    preferences,
    models,
    customProviders,
  });

  onMount(() => {
    void initialization.initialize();

    // Release resources if this component unmounts while the page stays alive.
    return () => {
      initialization.dispose();
      auth.dispose();
      preferences.dispose();
      models.dispose();
      customProviders.dispose();
      feedback.dispose();
    };
  });
</script>

<div class="h-full overflow-y-auto">
  {#if !initialization.state.initialized}
    <p class="p-4 text-sm text-muted" role="status">Loading settings…</p>
  {:else}
    {#if initialization.state.failures.length > 0}
      <div
        class="p-3 text-sm text-foreground bg-surface border-b border-border"
        role="alert"
      >
        <p>Some settings could not be loaded.</p>
        {#each initialization.state.failures as failure}
          <p class="text-xs text-muted">{failure.name}: {failure.message}</p>
        {/each}
        <button
          type="button"
          class="mt-1 underline underline-offset-2 cursor-pointer"
          disabled={initialization.state.loading}
          onclick={initialization.initialize}
        >
          {initialization.state.loading ? 'Loading…' : 'Retry'}
        </button>
      </div>
    {/if}
    <PopupRouter />
  {/if}
</div>
<PopupToastContainer
  toasts={feedback.toasts}
  ondismiss={feedback.dismiss.bind(feedback)}
/>
