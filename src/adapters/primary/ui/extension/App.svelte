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
  } from '../shared/context';
  import { useAuth } from '../shared/hooks/useAuth.svelte';
  import { usePreferences } from '../shared/hooks/usePreferences.svelte';
  import { useModels } from '../shared/hooks/useModels.svelte';
  import { useCustomProviders } from '../shared/hooks/useCustomProviders.svelte';
  import { PopupToastContainer } from '../shared/components';
  import { PopupToastController } from '../shared/toast/PopupToastController.svelte';
  import PopupRouter from './PopupRouter.svelte';
  import { createPopupLifecycle } from './popup-lifecycle.svelte';

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

  setPopupToastContext(feedback);

  const auth = useAuth();

  setAuthStateContext(auth);

  // svelte-ignore state_referenced_locally
  const preferences = usePreferences(preferencesUseCases);

  setPreferencesStateContext(preferences);

  const models = useModels();

  setModelsStateContext(models);

  const customProviders = useCustomProviders();

  setCustomProvidersStateContext(customProviders);

  const lifecycle = createPopupLifecycle({
    auth,
    preferences,
    models,
    customProviders,
    disposeFeedback: () => feedback.dispose(),
  });

  onMount(() => {
    void lifecycle.initialize();

    return lifecycle.dispose;
  });
</script>

<div class="h-full overflow-y-auto">
  {#if !lifecycle.state.initialized}
    <p class="p-4 text-sm text-muted" role="status">Loading settings…</p>
  {:else}
    {#if lifecycle.state.failures.length > 0}
      <div
        class="p-3 text-sm text-foreground bg-surface border-b border-border"
        role="alert"
      >
        <p>Some settings could not be loaded.</p>
        {#each lifecycle.state.failures as failure}
          <p class="text-xs text-muted">{failure.name}: {failure.message}</p>
        {/each}
        <button
          type="button"
          class="mt-1 underline underline-offset-2 cursor-pointer"
          disabled={lifecycle.state.loading}
          onclick={() => lifecycle.initialize()}
        >
          {lifecycle.state.loading ? 'Loading…' : 'Retry'}
        </button>
      </div>
    {/if}
    <PopupRouter />
  {/if}
</div>
<PopupToastContainer />
