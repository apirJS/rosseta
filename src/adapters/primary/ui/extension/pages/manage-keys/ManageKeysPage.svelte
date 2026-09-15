<script lang="ts">
  import {
    getAuthStateContext,
    getCustomProvidersStateContext,
    getModelsStateContext,
    getPreferencesStateContext,
    getPopupToastContext,
  } from '../../../shared/context';
  import { Icon, Select, ThemeToggle } from '../../../shared/components';
  import { PROVIDERS } from '../../../../../../core/domain/credential/Provider';
  import { ProviderRegistry } from '../../../../../../core/domain/provider/ProviderRegistry';
  import {
    createManageKeysController,
    type ManageKeysDeps,
  } from './ManageKeysController.svelte';
  import ApiKeyListItem from './components/ApiKeyListItem.svelte';
  import ApiKeyViewerModal from './components/ApiKeyViewerModal.svelte';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();
  const auth = getAuthStateContext();
  const preferences = getPreferencesStateContext();
  const models = getModelsStateContext();
  const customProviders = getCustomProvidersStateContext();
  const toast = getPopupToastContext();

  const allProviderIds = $derived([
    ...PROVIDERS,
    ...customProviders.state.providers.map((p) => p.id),
  ]);

  const deps: ManageKeysDeps = {
    credentials: () => auth.state.credentials,
    addApiKey: auth.addApiKey,
    removeApiKey: auth.removeApiKey,
    setActiveKey: (credentialId) => {
      void auth.setActiveKey(credentialId);
    },
    modelsFor: models.modelsFor,
    fetchModels: models.fetchModels,
    clearAllModels: async () => {
      await Promise.all(
        allProviderIds.map((provider) => models.clearModels(provider)),
      );
    },
    toast,
  };

  const controller = createManageKeysController(deps);

  $effect(() => {
    return () => controller.destroy();
  });

  const providerOptions = $derived(
    allProviderIds.map((id) => ({
      value: id,
      label: ProviderRegistry.getConfig(id).name,
    })),
  );

  const selectedProviderName = $derived(
    ProviderRegistry.getConfig(controller.state.selectedProvider).name,
  );

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') controller.addApiKey();
  }
</script>

<div class="flex flex-col h-full w-full bg-background">
  <div class="flex items-center p-4 pb-0">
    <button
      type="button"
      class="flex items-center text-sm text-muted hover:text-foreground cursor-pointer"
      onclick={() => {
        controller.commitPendingDelete();
        onback();
      }}
      aria-label="Back"
    >
      <Icon name="arrow-left" class="w-4 h-4" />
    </button>
    <h2 class="flex-1 text-center text-base font-semibold text-foreground">
      API Keys
    </h2>
    <ThemeToggle
      isDark={preferences.state.resolvedTheme === 'dark'}
      onToggle={preferences.toggleTheme}
    />
  </div>

  <div class="flex-1 flex flex-col px-4 py-4 min-h-0 overflow-hidden">
    <div class="flex gap-2 mb-3">
      <div class="w-28 shrink-0">
        <Select
          id="new-key-provider"
          value={controller.state.selectedProvider}
          options={providerOptions}
          onchange={(value) =>
            (controller.state.selectedProvider = value as typeof controller.state.selectedProvider)}
        />
      </div>
      <input
        type="password"
        class="flex-1 min-w-0 px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-primary"
        placeholder={`${selectedProviderName} API Key`}
        bind:value={controller.state.apiKeyInput}
        onkeydown={handleKeydown}
      />
      <button
        type="button"
        class="flex items-center justify-center w-10 shrink-0 rounded-lg bg-primary text-primary-fg hover:opacity-90 cursor-pointer disabled:opacity-50"
        onclick={() => controller.addApiKey()}
        disabled={auth.state.loading}
        aria-label="Add API key"
        title="Add API key"
      >
        <Icon name="plus" class="w-4 h-4" />
      </button>
    </div>

    <div class="relative mb-3">
      <input
        type="text"
        class="w-full pl-8 pr-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-primary"
        placeholder="Search keys"
        bind:value={controller.state.searchQuery}
      />
      <span
        class="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none"
      >
        <Icon name="search" class="w-4 h-4 text-muted" />
      </span>
    </div>

    <div class="flex flex-col gap-2 overflow-y-auto">
      {#each controller.visibleKeys as credential (credential.id)}
        <ApiKeyListItem
          {credential}
          isActive={auth.state.credentials?.activeCredentialId ===
            credential.id}
          onSetActive={() => controller.setActiveKey(credential)}
          onDelete={() => controller.requestDelete(credential.id)}
          onView={() => controller.viewKey(credential.id)}
        />
      {:else}
        {#if controller.allKeys.length === 0}
          <p class="text-sm text-muted text-center py-4">
            No API keys yet. Add one above.
          </p>
        {:else}
          <p class="text-sm text-muted text-center py-4">
            No keys match your search.
          </p>
        {/if}
      {/each}
    </div>
  </div>

  {#if controller.state.pendingDeleteId}
    <div
      class="flex items-center justify-between px-3 py-2 bg-surface border-t border-border text-sm"
    >
      <span class="text-muted">API key deleted</span>
      <button
        type="button"
        class="text-primary font-medium hover:underline cursor-pointer"
        onclick={() => controller.cancelPendingDelete()}
      >
        Undo
      </button>
    </div>
  {/if}
</div>

{#if controller.viewingKey}
  <ApiKeyViewerModal
    apiKey={controller.viewingKey}
    onclose={() => controller.closeViewer()}
  />
{/if}
