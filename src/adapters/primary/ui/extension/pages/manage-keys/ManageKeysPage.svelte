<script lang="ts">
  import {
    getAuthStateContext,
    getPreferencesStateContext,
  } from '../../../shared/context';
  import { Icon, ThemeToggle } from '../../../shared/components';
  import type { Credential } from '../../../../../../core/domain/credential/Credential';
  import ApiKeyListItem from './components/ApiKeyListItem.svelte';
  import ApiKeyViewerModal from './components/ApiKeyViewerModal.svelte';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();
  const auth = getAuthStateContext();
  const preferences = getPreferencesStateContext();

  let apiKeyInput = $state('');
  let duplicateError = $state('');
  let viewingKey = $state<string | null>(null);

  const allKeys = $derived(auth.state.credentials?.items ?? []);

  // Dynamic search: filter keys as user types
  const filteredKeys = $derived.by(() => {
    const query = apiKeyInput.trim().toLowerCase();
    if (!query) return allKeys;
    return allKeys.filter(
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
</script>

<div class="flex flex-col h-full w-full bg-background">
  <!-- Header -->
  <div class="flex items-center p-4 pb-0">
    <button
      type="button"
      class="flex items-center text-sm text-muted hover:text-foreground cursor-pointer"
      onclick={onback}
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
        placeholder="Gemini or Groq API Key"
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
            onDelete={() => auth.removeApiKey(credential.id)}
            onView={() => (viewingKey = credential.apiKey.value)}
          />
        {/each}
      {/if}

      {#if !auth.state.credentials?.hasKeys()}
        <p class="text-sm text-muted text-center py-4">
          No API keys added yet.
        </p>
      {:else if filteredKeys.length === 0}
        <p class="text-sm text-muted text-center py-4">
          No keys match your search.
        </p>
      {/if}
    </div>
  </div>
</div>

{#if viewingKey}
  <ApiKeyViewerModal apiKey={viewingKey} onclose={() => (viewingKey = null)} />
{/if}
