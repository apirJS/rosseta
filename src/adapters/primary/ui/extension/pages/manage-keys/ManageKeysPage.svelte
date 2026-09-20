<script lang="ts">
  import {
    getAuthStateContext,
    getCustomProvidersStateContext,
    getModelsStateContext,
    getPreferencesStateContext,
    getPopupToastContext,
  } from '../../../shared/context';
  import {
    AddItemBar,
    EmptyState,
    PageShell,
    ProviderSelector,
    UndoBar,
  } from '../../../shared/components';
  import {
    PROVIDERS,
    type AnyProvider,
  } from '../../../../../../core/domain/credential/Provider';
  import {
    createManageKeysController,
    type ManageKeysDeps,
  } from './ManageKeysController.svelte';
  import ApiKeyListItem from './components/ApiKeyListItem.svelte';
  import ApiKeyViewerModal from './components/ApiKeyViewerModal.svelte';

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

  const allProviderIds = $derived([
    ...PROVIDERS,
    ...customProviders.state.providers.map((p) => p.id),
  ]);

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
        allProviderIds.map((provider) => models.clearModels(provider)),
      );
    },
    toast,
  };

  // svelte-ignore state_referenced_locally
  const controller = createManageKeysController(
    deps,
    initialProvider ?? 'google',
  );

  $effect(() => {
    return () => controller.destroy();
  });
</script>

<PageShell
  onback={() => {
    controller.commitPendingDelete();
    onback();
  }}
  isDark={preferences.state.resolvedTheme === 'dark'}
  onToggleTheme={preferences.toggleTheme}
>
  {#snippet start()}
    <div class="w-28 shrink-0">
      <ProviderSelector
        value={controller.state.selectedProvider}
        compact
        onchange={(value) => controller.setProvider(value as AnyProvider)}
      />
    </div>
  {/snippet}

  <AddItemBar
    class="mb-3"
    type="password"
    bind:value={controller.state.keyInput}
    placeholder="Search or add key…"
    addLabel="Add API key"
    canAdd={controller.canAddKey}
    disabled={auth.state.loading}
    onadd={() => controller.addApiKey()}
  />
  {#if controller.state.selectedProvider === 'puter'}
    <p class="mb-3 text-xs text-muted">
      Get your Puter token from
      <a
        href="https://puter.com/#account"
        target="_blank"
        rel="noreferrer"
        class="text-primary hover:underline"
      >
        Puter account settings
      </a>.
    </p>
  {/if}

  <div class="flex flex-col gap-1.5 overflow-y-auto flex-1">
    {#each controller.visibleKeys as credential (credential.id)}
      <ApiKeyListItem
        {credential}
        isActive={auth.state.keySelectionMode.isManual &&
          auth.state.credentials?.activeCredentialId === credential.id}
        onSetActive={() => controller.setActiveKey(credential)}
        onDelete={() => controller.requestDelete(credential.id)}
        onView={() => controller.viewKey(credential.id)}
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

{#if controller.viewingKey}
  <ApiKeyViewerModal
    apiKey={controller.viewingKey}
    onclose={() => controller.closeViewer()}
  />
{/if}
