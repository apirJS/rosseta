<script lang="ts">
  import PageShell from '../../../shared/components/PageShell.svelte';
  import Icon from '../../../shared/components/Icon.svelte';
  import { getPreferencesStateContext } from '../../../shared/context';
  import HistoryItem from './components/HistoryItem.svelte';
  import {
    createHistoryController,
    type TimeFilter,
  } from './HistoryController.svelte';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();

  const controller = createHistoryController();
  const preferences = getPreferencesStateContext();

  const timeFilterOptions: { value: TimeFilter; label: string }[] = [
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: 'all', label: 'All time' },
  ];

  // Load history on mount
  $effect(() => {
    controller.load();
  });
</script>

<PageShell
  showBack
  {onback}
  isDark={preferences.state.resolvedTheme === 'dark'}
  onToggleTheme={preferences.toggleTheme}
>
  <!-- Search + Filter Bar (Fixed) -->
  <div class="flex gap-2 mb-3">
    <div class="relative flex-1">
      <Icon
        name="search"
        class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"
      />
      <input
        type="text"
        placeholder="Search..."
        class="w-full pl-8 pr-3 py-1.5 text-sm bg-surface border border-border rounded-md text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
        value={controller.state.searchQuery}
        oninput={(e: Event) =>
          controller.setSearchQuery((e.target as HTMLInputElement).value)}
      />
    </div>
    <select
      class="px-2 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:border-primary cursor-pointer"
      value={controller.state.timeFilter}
      onchange={(e: Event) =>
        controller.setTimeFilter(
          (e.target as HTMLSelectElement).value as TimeFilter,
        )}
    >
      {#each timeFilterOptions as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  <!-- Scrollable History List -->
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
      <p class="text-center text-sm text-muted py-8">
        {controller.state.searchQuery ? 'No results found' : 'No history yet'}
      </p>
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

  <!-- Undo Delete Banner -->
  {#if controller.state.pendingDelete}
    <div
      class="flex items-center justify-between px-3 py-2 bg-surface border-t border-border text-sm"
    >
      <span class="text-muted">Translation deleted</span>
      <button
        type="button"
        class="text-primary font-medium hover:underline cursor-pointer"
        onclick={controller.undoDelete}
      >
        Undo
      </button>
    </div>
  {/if}
</PageShell>
