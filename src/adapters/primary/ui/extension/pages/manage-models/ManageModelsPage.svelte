<script lang="ts">
  import {
    getAuthStateContext,
    getCustomProvidersStateContext,
    getPreferencesStateContext,
    getModelsStateContext,
    getPopupToastContext,
  } from '../../../shared/context';
  import { Icon, Select, ThemeToggle } from '../../../shared/components';
  import { PROVIDERS } from '../../../../../../core/domain/credential/Provider';
  import { ProviderRegistry } from '../../../../../../core/domain/provider/ProviderRegistry';
  import {
    createManageModelsController,
    type ManageModelsDeps,
  } from './ManageModelsController.svelte';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();
  const auth = getAuthStateContext();
  const preferences = getPreferencesStateContext();
  const models = getModelsStateContext();
  const customProviders = getCustomProvidersStateContext();
  const toast = getPopupToastContext();

  const providers = [
    ...PROVIDERS.map((id) => ({
      id,
      name: ProviderRegistry.getConfig(id).name,
    })),
    ...customProviders.state.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
    })),
  ];

  const deps: ManageModelsDeps = {
    providers,
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

  const providerOptions = $derived(
    controller.providers.map((p) => ({ value: p.id, label: p.name })),
  );

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') controller.addModel();
  }
</script>

<div class="flex flex-col h-full w-full bg-background">
  <div class="flex items-center p-4 pb-0 gap-2">
    <button
      type="button"
      class="flex items-center text-sm text-muted hover:text-foreground cursor-pointer"
      onclick={onback}
      aria-label="Back"
    >
      <Icon name="arrow-left" class="w-4 h-4" />
    </button>

    <div class="w-28 shrink-0">
      <Select
        id="provider-select"
        value={controller.state.selectedProvider}
        options={providerOptions}
        onchange={(value) => controller.setProvider(value)}
      />
    </div>
    <div class="flex-1"></div>

    <ThemeToggle
      isDark={preferences.state.resolvedTheme === 'dark'}
      onToggle={preferences.toggleTheme}
    />
  </div>

  <div class="flex-1 flex flex-col px-4 py-3 min-h-0 overflow-hidden">
    <div class="flex gap-2 mb-3">
      <input
        type="text"
        class="flex-1 min-w-0 px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-primary"
        placeholder="Search or add model…"
        bind:value={controller.state.modelInput}
        onkeydown={handleKeydown}
      />
      <button
        type="button"
        class="flex items-center justify-center w-10 shrink-0 rounded-lg bg-primary text-primary-fg hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={() => controller.addModel()}
        disabled={!controller.canAddModel}
        aria-label="Add model"
        title="Add model"
      >
        <Icon name="plus" class="w-4 h-4" />
      </button>
    </div>

    <div class="flex flex-col gap-1.5 overflow-y-auto flex-1">
      {#if controller.canAddModel}
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg border border-dashed border-border hover:border-primary/50 px-3 py-2 text-left cursor-pointer"
          onclick={() => controller.addModel()}
          title="Add this model"
        >
          <Icon name="plus" class="w-4 h-4 text-primary shrink-0" />
          <span class="text-sm text-muted truncate">
            Add <span class="text-foreground font-medium">{controller.state.modelInput.trim()}</span>
          </span>
        </button>
      {/if}

      {#each controller.filteredModels as model (model.id)}
        {@const isSelected = model.id === controller.selectedModelId}
        <div
          class="group flex items-center rounded-lg border transition-colors {isSelected
            ? 'border-primary/50 bg-surface'
            : 'border-border bg-surface'}"
        >
          <button
            type="button"
            class="flex-1 flex items-center gap-2 min-w-0 px-3 py-2 text-left cursor-pointer"
            onclick={() => controller.selectModel(model.id)}
            title="Use this model"
          >
            <span class="text-sm text-foreground truncate" title={model.id}>
              {model.name !== model.id ? model.name : model.id}
            </span>
            {#if isSelected}
              <Icon name="check" class="w-4 h-4 text-primary shrink-0" />
            {/if}
          </button>
          <button
            type="button"
            class="text-muted hover:text-destructive cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 mr-2"
            onclick={() => controller.removeModel(model.id)}
            title="Remove model"
          >
            <Icon name="trash" class="w-4 h-4" />
          </button>
        </div>
      {:else}
        {#if !controller.canAddModel}
          <p class="text-sm text-muted text-center py-8">
            {#if controller.models.length === 0}
              No models yet. Fetch from API or add manually.
            {:else}
              No models match your search.
            {/if}
          </p>
        {/if}
      {/each}
    </div>
  </div>

  <div class="flex items-center gap-2 px-4 py-3 border-t border-border">
    <button
      type="button"
      class="px-3 py-1.5 rounded-lg bg-primary text-primary-fg text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
      onclick={() => controller.fetchModels()}
      disabled={controller.state.isFetching}
    >
      {#if controller.state.isFetching}
        <Icon name="spinner" class="w-4 h-4" />
      {/if}
      {controller.state.isFetching ? 'Fetching…' : 'Fetch Models'}
    </button>
    <button
      type="button"
      class="px-3 py-1.5 rounded-lg bg-surface border border-border text-sm text-muted hover:text-foreground cursor-pointer ml-auto"
      onclick={() => controller.resetModels()}
    >
      Reset
    </button>
  </div>
</div>
