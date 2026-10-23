<script lang="ts">
  import { onMount } from 'svelte';
  import {
    EmptyState,
    Icon,
    PageShell,
    UndoBar,
  } from '../../../shared/components';
  import {
    getPreferencesStateContext,
    getTranslationContext,
  } from '../../context';
  import { sendMessageToRuntime } from '../../../../../../shared/messaging';
  import { serializeForModal } from '../../../../../../shared/types/TranslationModalPayload';
  import { createHistoryController } from './HistoryController.svelte';
  import HistoryItem from './components/HistoryItem.svelte';
  import HistorySearchBar from './components/HistorySearchBar.svelte';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();

  const translations = getTranslationContext();

  const controller = createHistoryController({
    load: () => translations.getAllTranslations.execute(),
    remove: (id) => translations.deleteTranslation.execute(id),
    open: async (translation) => {
      await sendMessageToRuntime({
        action: 'MOUNT_HISTORY_MODAL',
        payload: serializeForModal(translation),
      });
    },
  });

  const preferences = getPreferencesStateContext();

  onMount(() => {
    void controller.load();

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
    {#if controller.state.error}
      <p class="text-center text-sm text-red-400 py-4" role="alert">
        {controller.state.error}
      </p>
    {/if}
    {#if controller.state.loading}
      <div class="flex items-center justify-center py-8 text-muted">
        <Icon name="spinner" class="w-5 h-5" />
      </div>
    {:else if controller.items.length === 0}
      {#if !controller.state.error}
        <EmptyState
          message={controller.state.searchQuery
            ? 'No results found'
            : 'No history yet'}
        />
      {/if}
    {:else}
      {#each controller.items as item (item.id)}
        <HistoryItem
          previewText={item.previewText}
          formattedDate={item.formattedDate}
          onopen={() => controller.openItem(item.id)}
          ondelete={() => controller.deleteItem(item.id)}
        />
      {/each}
    {/if}
  </div>

  {#snippet footer()}
    {#if controller.state.pendingDeleteId}
      <UndoBar message="Translation deleted" onundo={controller.undoDelete} />
    {/if}
  {/snippet}
</PageShell>
