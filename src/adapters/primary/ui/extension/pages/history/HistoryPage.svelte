<script lang="ts">
  import {
    EmptyState,
    Icon,
    PageShell,
    UndoBar,
  } from '../../../shared/components';
  import { getPreferencesStateContext } from '../../../shared/context';
  import { createHistoryController } from './HistoryController.svelte';
  import HistoryItem from './components/HistoryItem.svelte';
  import HistorySearchBar from './components/HistorySearchBar.svelte';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();

  const controller = createHistoryController();
  const preferences = getPreferencesStateContext();

  $effect(() => {
    controller.load();
    return () => controller.destroy();
  });
</script>

<PageShell
  {onback}
  isDark={preferences.state.resolvedTheme === 'dark'}
  onToggleTheme={preferences.toggleTheme}
>
  <HistorySearchBar
    class="mb-3"
    searchQuery={controller.state.searchQuery}
    timeFilter={controller.state.timeFilter}
    onsearch={controller.setSearchQuery}
    onfilter={controller.setTimeFilter}
  />

  <div class="flex-1 overflow-y-auto flex flex-col gap-1.5 min-h-0 -mx-1 px-1">
    {#if controller.state.loading}
      <div class="flex items-center justify-center py-8 text-muted">
        <Icon name="spinner" class="w-5 h-5" />
      </div>
    {:else if controller.state.error}
      <p class="text-center text-sm text-red-400 py-4">
        {controller.state.error}
      </p>
    {:else if controller.filtered.length === 0}
      <EmptyState
        message={controller.state.searchQuery
          ? 'No results found'
          : 'No history yet'}
      />
    {:else}
      {#each controller.filtered as translation (translation.id)}
        <HistoryItem
          {translation}
          onopen={() => controller.openItem(translation)}
          ondelete={() => controller.deleteItem(translation.id)}
        />
      {/each}
    {/if}
  </div>

  {#snippet footer()}
    {#if controller.state.pendingDelete}
      <UndoBar
        message="Translation deleted"
        onundo={controller.undoDelete}
      />
    {/if}
  {/snippet}
</PageShell>
