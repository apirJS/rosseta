<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    getAuthStateContext,
    getCustomProvidersStateContext,
    getModelsStateContext,
    getPreferencesStateContext,
    getPopupToastContext,
  } from '../../context';
  import {
    AddItemBar,
    EmptyState,
    PageShell,
    ProviderSelector,
    UndoBar,
  } from '../../../shared/components';
  import type { AnyProvider } from '../../../../../../core/domain/credential/Provider';
  import {
    createManageKeysController,
    type ManageKeysDeps,
  } from './ManageKeysController.svelte';
  import ApiKeyListItem from './components/ApiKeyListItem.svelte';
  import ApiKeyViewerModal from './components/ApiKeyViewerModal.svelte';
  import { createApiKeyViewerController } from './ApiKeyViewerController.svelte';

  interface Props {
    onback: () => void;
    initialProvider?: AnyProvider | null;
  }

  const { onback, initialProvider = 'google' }: Props = $props();

  const auth = getAuthStateContext();
  const preferences = getPreferencesStateContext();
  const models = getModelsStateContext();
  const customProviders = getCustomProvidersStateContext();
  const toast = getPopupToastContext();

  const deps: ManageKeysDeps = {
    credentials: () => auth.state.credentials,
    addApiKey: auth.addApiKey,
    removeApiKey: auth.removeApiKey,
    setActiveKey: auth.setActiveKey,
    currentKeySelectionMode: () => auth.state.keySelectionMode,
    setKeySelectionMode: auth.setKeySelectionMode,
    modelsFor: models.modelsFor,
    fetchModels: models.fetchModels,
    clearAllModels: async () => {
      await Promise.all(
        customProviders.options.map(({ value }) => models.clearModels(value)),
      );
    },
    toast,
  };

  // svelte-ignore state_referenced_locally
  const controller = createManageKeysController(
    deps,
    initialProvider ?? 'google',
  );

  const viewer = createApiKeyViewerController({
    copyText: (value) => navigator.clipboard.writeText(value),
    toast,
  });

  onDestroy(() => {
    controller.destroy();
    viewer.close();
  });
</script>

<PageShell
  {onback}
  isDark={preferences.state.resolvedTheme === 'dark'}
  onToggleTheme={preferences.toggleTheme}
>
  {#snippet start()}
    <div class="w-28 shrink-0">
      <ProviderSelector
        options={customProviders.options}
        value={controller.state.selectedProvider}
        compact
        onchange={(value) => controller.setProvider(value as AnyProvider)}
      />
    </div>
  {/snippet}

  <AddItemBar
    class="mb-3"
    type="text"
    bind:value={controller.state.keyInput}
    placeholder="Search or add key…"
    addLabel="Add API key"
    canAdd={controller.canAddKey}
    disabled={auth.state.loading}
    onadd={() => controller.addApiKey()}
  />

  <div class="flex flex-col gap-1.5 overflow-y-auto flex-1">
    {#each controller.visibleKeys as credential (credential.id)}
      <ApiKeyListItem
        {credential}
        isActive={auth.state.keySelectionMode.isManual &&
          auth.state.credentials?.activeCredentialId === credential.id}
        onSetActive={() => controller.setActiveKey(credential)}
        onDelete={() => controller.requestDelete(credential.id)}
        onView={() => viewer.open(credential.apiKey.value)}
      />
    {:else}
      {#if !controller.canAddKey}
        <EmptyState
          message={controller.providerKeys.length === 0
            ? 'No API keys for this provider yet. Add one above.'
            : 'No keys match your search.'}
        />
      {/if}
    {/each}
  </div>

  {#snippet footer()}
    {#if controller.state.pendingDeleteId}
      <UndoBar
        message="API key deleted"
        onundo={() => controller.cancelPendingDelete()}
      />
    {/if}
  {/snippet}
</PageShell>

{#if viewer.state.apiKey}
  <ApiKeyViewerModal
    apiKey={viewer.state.apiKey}
    copied={viewer.state.copied}
    oncopy={viewer.copy}
    onclose={viewer.close}
  />
{/if}
