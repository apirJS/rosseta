<script lang="ts">
  import {
    getAuthStateContext,
    getModelsStateContext,
    getPreferencesStateContext,
    getPopupToastContext,
  } from '../../../shared/context';
  import {
    AddItemBar,
    EmptyState,
    PageShell,
    ProviderSelector,
  } from '../../../shared/components';
  import {
    createManageModelsController,
    type ManageModelsDeps,
  } from './ManageModelsController.svelte';
  import ModelListItem from './components/ModelListItem.svelte';
  import ModelListActions from './components/ModelListActions.svelte';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();

  const auth = getAuthStateContext();
  const preferences = getPreferencesStateContext();
  const models = getModelsStateContext();
  const toast = getPopupToastContext();

  const deps: ManageModelsDeps = {
    modelsFor: models.modelsFor,
    addModel: models.addCustomModel,
    removeModel: models.removeCustomModel,
    clearModels: models.clearModels,
    fetchModels: models.fetchModels,
    hasApiKeyFor: (provider) => {
      const credentials = auth.state.credentials;
      if (!credentials) return false;
      return credentials.getByProvider(provider).length > 0;
    },
    selectedModelFor: (provider) => preferences.state.selectedModels[provider],
    selectModel: (provider, modelId) => {
      void preferences.setSelectedModelFor(provider, modelId);
    },
    toast,
  };

  const controller = createManageModelsController(deps);
</script>

<PageShell
  {onback}
  isDark={preferences.state.resolvedTheme === 'dark'}
  onToggleTheme={preferences.toggleTheme}
>
  {#snippet start()}
    <div class="w-28 shrink-0">
      <ProviderSelector
        value={controller.state.selectedProvider}
        compact
        onchange={(value) => controller.setProvider(value)}
      />
    </div>
  {/snippet}

  <AddItemBar
    class="mb-3"
    bind:value={controller.state.modelInput}
    placeholder="Search or add model…"
    addLabel="Add model"
    canAdd={controller.canAddModel}
    onadd={() => controller.addModel()}
  />

  <div class="flex flex-col gap-1.5 overflow-y-auto flex-1">
    {#each controller.filteredModels as model (model.id)}
      <ModelListItem
        {model}
        selected={model.id === controller.selectedModelId}
        onselect={() => controller.selectModel(model.id)}
        onremove={() => controller.removeModel(model.id)}
      />
    {:else}
      {#if !controller.canAddModel}
        <EmptyState
          message={controller.models.length === 0
            ? 'No models yet. Fetch from API or add manually.'
            : 'No models match your search.'}
        />
      {/if}
    {/each}
  </div>

  {#snippet footer()}
    <ModelListActions
      isFetching={controller.state.isFetching}
      onfetch={() => controller.fetchModels()}
      onreset={() => controller.resetModels()}
    />
  {/snippet}
</PageShell>
