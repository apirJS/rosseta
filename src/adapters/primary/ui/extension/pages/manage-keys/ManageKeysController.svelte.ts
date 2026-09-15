import type { AnyProvider } from '../../../../../../core/domain/credential/Provider';
import type { Credential } from '../../../../../../core/domain/credential/Credential';
import type { Credentials } from '../../../../../../core/domain/credential/Credentials';
import type { StoredModel } from '../../../../../../core/ports/outbound/IModelStorage';
import type { Result } from '../../../../../../shared/types/Result';
import type { AppError } from '../../../../../../shared/errors';
import type { PopupToastController } from '../../../shared/toast/PopupToastController.svelte';

const UNDO_WINDOW_MS = 5000;

class ManageKeysState {
  selectedProvider = $state<AnyProvider>('google');
  apiKeyInput = $state('');
  searchQuery = $state('');
  viewingKeyId = $state<string | null>(null);
  pendingDeleteId = $state<string | null>(null);
}

export interface ManageKeysDeps {
  credentials: () => Credentials | null;
  addApiKey: (
    rawKey: string,
    provider: AnyProvider,
  ) => Promise<string | null>;
  removeApiKey: (credentialId: string) => Promise<string | null>;
  setActiveKey: (credentialId: string) => void;
  modelsFor: (provider: string) => StoredModel[];
  fetchModels: (
    provider: string,
  ) => Promise<Result<StoredModel[], AppError>>;
  clearAllModels: () => Promise<void>;
  toast: PopupToastController;
}

export function createManageKeysController(deps: ManageKeysDeps) {
  const state = new ManageKeysState();
  let deleteTimer: ReturnType<typeof setTimeout> | null = null;

  const allKeys = $derived(deps.credentials()?.items ?? []);

  const visibleKeys = $derived.by(() => {
    const pending = state.pendingDeleteId;
    const base = pending ? allKeys.filter((c) => c.id !== pending) : allKeys;
    const query = state.searchQuery.trim().toLowerCase();
    if (!query) return base;
    return base.filter(
      (c) =>
        c.apiKey.value.toLowerCase().includes(query) ||
        c.provider.toLowerCase().includes(query),
    );
  });

  const viewingKey = $derived.by(() => {
    if (!state.viewingKeyId) return null;
    const match = allKeys.find((c) => c.id === state.viewingKeyId);
    return match ? match.apiKey.value : null;
  });

  async function addApiKey() {
    const trimmed = state.apiKeyInput.trim();
    if (!trimmed) return;

    if (allKeys.some((c) => c.apiKey.value === trimmed)) {
      deps.toast.show({
        type: 'error',
        message: 'Key already added',
        description: 'This API key is already in your list.',
      });
      return;
    }

    const error = await deps.addApiKey(trimmed, state.selectedProvider);
    if (error) {
      deps.toast.show({
        type: 'error',
        message: 'Could not add key',
        description: error,
      });
      return;
    }

    state.apiKeyInput = '';
    deps.toast.show({ type: 'success', message: 'API key added' });

    if (deps.modelsFor(state.selectedProvider).length === 0) {
      void autoFetchModels(state.selectedProvider);
    }
  }

  async function autoFetchModels(provider: AnyProvider) {
    const result = await deps.fetchModels(provider);
    if (result.success) {
      deps.toast.show({
        type: 'success',
        message: `Loaded ${result.data.length} models`,
        description: 'Models fetched automatically for the new key.',
      });
    } else {
      deps.toast.show({
        type: 'error',
        message: 'Could not fetch models',
        description: result.error.message,
      });
    }
  }

  function requestDelete(credentialId: string) {
    cancelPendingDelete();
    state.pendingDeleteId = credentialId;
    deleteTimer = setTimeout(() => {
      commitPendingDelete();
    }, UNDO_WINDOW_MS);
  }

  async function commitPendingDelete() {
    const id = state.pendingDeleteId;
    if (!id) return;

    if (deleteTimer) {
      clearTimeout(deleteTimer);
      deleteTimer = null;
    }
    state.pendingDeleteId = null;

    const error = await deps.removeApiKey(id);
    if (error) {
      deps.toast.show({
        type: 'error',
        message: 'Could not delete key',
        description: error,
      });
      return;
    }

    const remaining = deps.credentials();
    if (!remaining || remaining.items.length === 0) {
      await deps.clearAllModels();
    }
  }

  function cancelPendingDelete() {
    if (deleteTimer) {
      clearTimeout(deleteTimer);
      deleteTimer = null;
    }
    state.pendingDeleteId = null;
  }

  function setActiveKey(credential: Credential) {
    deps.setActiveKey(credential.id);
  }

  function viewKey(credentialId: string) {
    state.viewingKeyId = credentialId;
  }

  function closeViewer() {
    state.viewingKeyId = null;
  }

  function destroy() {
    if (deleteTimer) {
      clearTimeout(deleteTimer);
      deleteTimer = null;
    }
  }

  return {
    state,
    get allKeys() {
      return allKeys;
    },
    get visibleKeys() {
      return visibleKeys;
    },
    get viewingKey() {
      return viewingKey;
    },
    addApiKey,
    requestDelete,
    commitPendingDelete,
    cancelPendingDelete,
    setActiveKey,
    viewKey,
    closeViewer,
    destroy,
  };
}
