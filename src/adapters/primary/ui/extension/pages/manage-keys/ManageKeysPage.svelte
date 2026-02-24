<script lang="ts">
  import {
    getAuthStateContext,
    getPreferencesStateContext,
  } from '../../../shared/context';
  import { Icon, ThemeToggle } from '../../../shared/components';
  import ApiKeyListItem from './components/ApiKeyListItem.svelte';
  import ApiKeyViewerModal from './components/ApiKeyViewerModal.svelte';
  import { useProviderCycle } from '../../../shared/hooks/useProviderCycle.svelte';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();
  const auth = getAuthStateContext();
  const preferences = getPreferencesStateContext();
  const provider = useProviderCycle();

  let apiKeyInput = $state('');
  let duplicateError = $state('');
  let viewingKey = $state<string | null>(null);
  let pendingDeleteId = $state<string | null>(null);
  let pendingDeleteTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  const allKeys = $derived(auth.state.credentials?.items ?? []);

  const visibleKeys = $derived(
    pendingDeleteId ? allKeys.filter((c) => c.id !== pendingDeleteId) : allKeys,
  );

  // Dynamic search: filter keys as user types
  const filteredKeys = $derived.by(() => {
    const query = apiKeyInput.trim().toLowerCase();
    if (!query) return visibleKeys;
    return visibleKeys.filter(
      (c) =>
        c.apiKey.value.toLowerCase().includes(query) ||
        c.provider.toLowerCase().includes(query),
    );
  });

  // Check for duplicate
  function isDuplicate(rawKey: string): boolean {
    return allKeys.some((c) => c.apiKey.value === rawKey.trim());
  }

  async function handleAdd() {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;

    if (isDuplicate(trimmed)) {
      duplicateError = 'This API key has already been added.';
      setTimeout(() => (duplicateError = ''), 3000);
      return;
    }

    duplicateError = '';
    await auth.addApiKey(trimmed);
    if (!auth.state.error) {
      apiKeyInput = '';
    }
  }

  function commitPendingDelete() {
    if (!pendingDeleteId) return;
    if (pendingDeleteTimer) clearTimeout(pendingDeleteTimer);
    auth.removeApiKey(pendingDeleteId);
    pendingDeleteId = null;
    pendingDeleteTimer = null;
  }

  function handleDelete(credentialId: string) {
    commitPendingDelete();
    pendingDeleteId = credentialId;
    pendingDeleteTimer = setTimeout(() => {
      auth.removeApiKey(credentialId);
      pendingDeleteId = null;
      pendingDeleteTimer = null;
    }, 5000);
  }

  function undoDelete() {
    if (!pendingDeleteId) return;
    if (pendingDeleteTimer) clearTimeout(pendingDeleteTimer);
    pendingDeleteId = null;
    pendingDeleteTimer = null;
  }
</script>

<div class="flex flex-col h-full w-full bg-background">
  <!-- Header -->
  <div class="flex items-center p-4 pb-0">
    <button
      type="button"
      class="flex items-center text-sm text-muted hover:text-foreground cursor-pointer"
      onclick={() => {
        commitPendingDelete();
        onback();
      }}
    >
      <Icon name="arrow-left" class="w-4 h-4 mr-1" />
    </button>
    <h2 class="flex-1 text-center text-base font-semibold text-foreground">
      Manage API Keys
    </h2>
    <ThemeToggle
      isDark={preferences.state.resolvedTheme === 'dark'}
      onToggle={preferences.toggleTheme}
    />
  </div>

  <!-- Content -->
  <div class="flex-1 flex flex-col px-4 py-4 min-h-0 overflow-hidden">
    <!-- Add new key -->
    <div class="flex gap-2 mb-4">
      <input
        type="text"
        class="flex-1 px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-primary"
        placeholder={`${provider.current.name} API Key`}
        bind:value={apiKeyInput}
        onkeydown={(e) => e.key === 'Enter' && handleAdd()}
      />
      <button
        type="button"
        class="px-3 py-2 rounded-lg bg-primary text-primary-fg text-sm font-medium hover:opacity-90 cursor-pointer whitespace-nowrap"
        onclick={handleAdd}
        disabled={auth.state.loading}
      >
        Add +
      </button>
    </div>

    {#if duplicateError}
      <p class="text-sm text-destructive mb-3">{duplicateError}</p>
    {/if}

    {#if auth.state.error}
      <p class="text-sm text-destructive mb-3">{auth.state.error}</p>
    {/if}

    <!-- Key list -->
    <div class="flex flex-col gap-2 overflow-y-auto">
      {#if auth.state.credentials}
        {#each filteredKeys as credential (credential.id)}
          <ApiKeyListItem
            {credential}
            isActive={auth.state.credentials.activeCredentialId ===
              credential.id}
            onSetActive={() => auth.setActiveKey(credential.id)}
            onDelete={() => handleDelete(credential.id)}
            onView={() => (viewingKey = credential.apiKey.value)}
          />
        {/each}
      {/if}

      {#if !auth.state.credentials?.hasKeys()}
        <p class="text-sm text-muted text-center py-4">
          No API keys added yet.
        </p>
      {:else if filteredKeys.length === 0 && !pendingDeleteId}
        <p class="text-sm text-muted text-center py-4">
          No keys match your search.
        </p>
      {/if}
    </div>
  </div>

  <!-- Undo banner -->
  {#if pendingDeleteId}
    <div
      class="flex items-center justify-between px-3 py-2 bg-surface border-t border-border text-sm"
    >
      <span class="text-muted">API key deleted</span>
      <button
        type="button"
        class="text-primary font-medium hover:underline cursor-pointer"
        onclick={undoDelete}
      >
        Undo
      </button>
    </div>
  {/if}
</div>

{#if viewingKey}
  <ApiKeyViewerModal apiKey={viewingKey} onclose={() => (viewingKey = null)} />
{/if}
