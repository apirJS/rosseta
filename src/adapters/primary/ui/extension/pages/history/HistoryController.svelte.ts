import type { Translation } from '../../../../../../core/domain/translation/Translation';
import type { IGetAllTranslationsUseCase } from '../../../../../../core/ports/inbound/history/IGetAllTranslationsUseCase';
import type { IDeleteTranslationUseCase } from '../../../../../../core/ports/inbound/history/IDeleteTranslationUseCase';

export type TimeFilter = '24h' | '7d' | 'all';

interface PendingDelete {
  translation: Translation;
  index: number;
  timer: ReturnType<typeof setTimeout>;
}

export interface HistoryDeps {
  load: IGetAllTranslationsUseCase['execute'];
  remove: IDeleteTranslationUseCase['execute'];
  open: (translation: Translation) => Promise<void>;
}

export interface HistoryListItem {
  id: string;
  previewText: string;
  formattedDate: string;
}

class HistoryState {
  translations = $state<Translation[]>([]);
  searchQuery = $state('');
  timeFilter = $state<TimeFilter>('all');
  loading = $state(false);
  error = $state<string | null>(null);
  pendingDeleteId = $state<string | null>(null);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatHistoryItem(translation: Translation): HistoryListItem {
  const date = translation.createdAt;

  return {
    id: translation.id,
    previewText: translation.original.map((segment) => segment.text).join(' '),
    formattedDate: `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function matchesSearch(translation: Translation, query: string): boolean {
  if (!query) return true;

  return (
    translation.description.toLowerCase().includes(query) ||
    [...translation.original, ...translation.translated].some((segment) =>
      [
        segment.text,
        segment.language.name,
        segment.language.code,
        segment.romanization ?? '',
      ].some((value) => value.toLowerCase().includes(query)),
    )
  );
}

export function createHistoryController(deps: HistoryDeps) {
  const state = new HistoryState();
  let pendingDelete: PendingDelete | null = null;

  function getFiltered(): Translation[] {
    const query = state.searchQuery.trim().toLowerCase();
    const days = state.timeFilter === '24h' ? 1 : 7;

    const cutoff =
      state.timeFilter === 'all' ? -Infinity : Date.now() - days * 86_400_000;

    return state.translations.filter(
      (translation) =>
        translation.createdAt.getTime() >= cutoff &&
        matchesSearch(translation, query),
    );
  }

  async function load() {
    state.loading = true;
    state.error = null;

    const result = await deps.load();

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

  function clearPendingDelete() {
    if (pendingDelete) clearTimeout(pendingDelete.timer);
    pendingDelete = null;
    state.pendingDeleteId = null;
  }

  function restoreItem(translation: Translation, index: number) {
    const copy = [...state.translations];

    copy.splice(Math.min(index, copy.length), 0, translation);
    state.translations = copy;
  }

  async function persistDelete(translation: Translation, index: number) {
    const result = await deps.remove(translation.id);

    if (!result.success) {
      restoreItem(translation, index);
      state.error = 'Failed to delete translation';
    }
  }

  function commitPendingDelete() {
    if (!pendingDelete) return;

    const { translation, index } = pendingDelete;

    clearPendingDelete();
    void persistDelete(translation, index);
  }

  function deleteItem(id: string) {
    commitPendingDelete();

    const idx = state.translations.findIndex((t) => t.id === id);

    if (idx === -1) return;

    const removed = state.translations[idx];

    state.translations = state.translations.filter((t) => t.id !== id);

    const timer = setTimeout(commitPendingDelete, 5000);

    pendingDelete = { translation: removed, index: idx, timer };
    state.pendingDeleteId = id;
  }

  function undoDelete() {
    if (!pendingDelete) return;

    const { translation, index } = pendingDelete;

    clearPendingDelete();
    restoreItem(translation, index);
  }

  async function openItem(id: string) {
    const translation = state.translations.find((item) => item.id === id);

    if (translation) await deps.open(translation);
  }

  function destroy() {
    commitPendingDelete();
  }

  return {
    state,
    get items() {
      return getFiltered().map(formatHistoryItem);
    },
    load,
    setSearchQuery,
    setTimeFilter,
    deleteItem,
    undoDelete,
    openItem,
    destroy,
  };
}
