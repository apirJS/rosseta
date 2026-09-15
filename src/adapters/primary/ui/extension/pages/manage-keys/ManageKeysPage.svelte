<script lang="ts">
  import {
    getAuthStateContext,
    getCustomProvidersStateContext,
    getModelsStateContext,
    getPreferencesStateContext,
    getPopupToastContext,
  } from '../../../shared/context';
  import { Icon, Select, ThemeToggle } from '../../../shared/components';
  import { maskApiKey } from '../../../shared/utils';
  import {
    PROVIDERS,
    type AnyProvider,
  } from '../../../../../../core/domain/credential/Provider';
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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') controller.addApiKey();
  }
</script>

<div class="flex flex-col h-full w-full bg-background">
  <div class="flex items-center p-4 pb-0 gap-2">
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

    <div class="w-28 shrink-0">
      <Select
        id="provider-select"
        value={controller.state.selectedProvider}
        options={providerOptions}
        onchange={(value) => controller.setProvider(value as AnyProvider)}
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
        type="password"
        class="flex-1 min-w-0 px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-primary"
        placeholder="Search or add key…"
        bind:value={controller.state.keyInput}
        onkeydown={handleKeydown}
      />
      <button
        type="button"
        class="flex items-center justify-center w-10 shrink-0 rounded-lg bg-primary text-primary-fg hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={() => controller.addApiKey()}
        disabled={!controller.canAddKey || auth.state.loading}
        aria-label="Add API key"
        title="Add API key"
      >
        <Icon name="plus" class="w-4 h-4" />
      </button>
    </div>
    <div class="flex flex-col gap-1.5 overflow-y-auto flex-1">
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
        {#if !controller.canAddKey}
          <p class="text-sm text-muted text-center py-8">
            {#if controller.providerKeys.length === 0}
              No API keys for this provider yet. Add one above.
            {:else}
              No keys match your search.
            {/if}
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
