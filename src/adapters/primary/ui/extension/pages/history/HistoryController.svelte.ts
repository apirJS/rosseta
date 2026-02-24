import { getTranslationContext } from '../../../shared/context';
import { sendMessageToRuntime } from '../../../../../../shared/messaging';
import { serializeForModal } from '../../../../content/handlers/TranslationModalHandler';
import type { Translation } from '../../../../../../core/domain/translation/Translation';

export type TimeFilter = '24h' | '7d' | 'all';

interface PendingDelete {
  translation: Translation;
  index: number;
  timer: ReturnType<typeof setTimeout>;
}

class HistoryState {
  translations = $state<Translation[]>([]);
  searchQuery = $state('');
  timeFilter = $state<TimeFilter>('all');
  loading = $state(false);
  error = $state<string | null>(null);
  pendingDelete = $state<PendingDelete | null>(null);
}

export function createHistoryController() {
  const ctx = getTranslationContext();
  const state = new HistoryState();

  function getFiltered(): Translation[] {
    let items = state.translations;

    // Time filter
    if (state.timeFilter !== 'all') {
      const now = Date.now();
      const cutoff =
        state.timeFilter === '24h'
          ? now - 24 * 60 * 60 * 1000
          : now - 7 * 24 * 60 * 60 * 1000;
      items = items.filter((t) => t.createdAt.getTime() >= cutoff);
    }

    // Search filter (match against original text segments)
    if (state.searchQuery.trim()) {
      const query = state.searchQuery.toLowerCase();
      items = items.filter((t) =>
        t.original.some((seg) => seg.text.toLowerCase().includes(query)),
      );
    }

    return items;
  }

  async function load() {
    state.loading = true;
    state.error = null;
    const result = await ctx.getAllTranslations.execute();
    if (result.success) {
      state.translations = result.data;
    } else {
      state.error = 'Failed to load history';
    }
    state.loading = false;
  }

  function setSearchQuery(value: string) {
    state.searchQuery = value;
  }

  function setTimeFilter(value: TimeFilter) {
    state.timeFilter = value;
  }

  /** Commit any pending delete immediately (fire-and-forget). */
  function commitPendingDelete() {
    if (!state.pendingDelete) return;
    clearTimeout(state.pendingDelete.timer);
    ctx.deleteTranslation.execute(state.pendingDelete.translation.id);
    state.pendingDelete = null;
  }

  function deleteItem(id: string) {
    // Commit any previously pending delete first
    commitPendingDelete();

    const idx = state.translations.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const removed = state.translations[idx];
    state.translations = state.translations.filter((t) => t.id !== id);

    const timer = setTimeout(() => {
      ctx.deleteTranslation.execute(id);
      state.pendingDelete = null;
    }, 5000);

    state.pendingDelete = { translation: removed, index: idx, timer };
  }

  function undoDelete() {
    if (!state.pendingDelete) return;
    clearTimeout(state.pendingDelete.timer);
    const { translation, index } = state.pendingDelete;
    const copy = [...state.translations];
    copy.splice(Math.min(index, copy.length), 0, translation);
    state.translations = copy;
    state.pendingDelete = null;
  }

  async function openItem(translation: Translation) {
    const payload = serializeForModal(translation);

    await sendMessageToRuntime({
      action: 'MOUNT_HISTORY_MODAL',
      payload,
    });
  }

  return {
    state,
    get filtered() {
      return getFiltered();
    },
    load,
    setSearchQuery,
    setTimeFilter,
    deleteItem,
    undoDelete,
    openItem,
  };
}
