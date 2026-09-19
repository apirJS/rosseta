import type { AnyProvider } from '../../../../../../core/domain/credential/Provider';
import type { Credential } from '../../../../../../core/domain/credential/Credential';
import type { Credentials } from '../../../../../../core/domain/credential/Credentials';
import { KeySelectionMode } from '../../../../../../core/domain/credential/KeySelectionMode';
import type { StoredModel } from '../../../../../../core/ports/outbound/IModelStorage';
import type { Result } from '../../../../../../shared/types/Result';
import { ERROR_TITLES, type AppError } from '../../../../../../shared/errors';
import type { PopupToastController } from '../../../shared/toast/PopupToastController.svelte';

const UNDO_WINDOW_MS = 5000;

class ManageKeysState {
  selectedProvider = $state<AnyProvider>('google');
  keyInput = $state('');
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
  setActiveKey: (credentialId: string) => Promise<string | null>;
  currentKeySelectionMode: () => KeySelectionMode;
  setKeySelectionMode: (mode: KeySelectionMode) => Promise<string | null>;
  modelsFor: (provider: string) => StoredModel[];
  fetchModels: (
    provider: string,
  ) => Promise<Result<StoredModel[], AppError>>;
  clearAllModels: () => Promise<void>;
  toast: PopupToastController;
}

export function createManageKeysController(
  deps: ManageKeysDeps,
  initialProvider: AnyProvider = 'google',
) {
  const state = new ManageKeysState();
  state.selectedProvider = initialProvider;
  let deleteTimer: ReturnType<typeof setTimeout> | null = null;

  const allKeys = $derived(deps.credentials()?.items ?? []);

  const providerKeys = $derived(
    allKeys.filter((c) => c.provider === state.selectedProvider),
  );

  const visibleKeys = $derived.by(() => {
    const pending = state.pendingDeleteId;
    const base = pending
      ? providerKeys.filter((c) => c.id !== pending)
      : providerKeys;
    const query = state.keyInput.trim().toLowerCase();
    if (!query) return base;
    return base.filter((c) =>
      c.apiKey.value.toLowerCase().includes(query),
    );
  });

  const canAddKey = $derived.by(() => {
    const key = state.keyInput.trim();
    return key !== '' && !allKeys.some((c) => c.apiKey.value === key);
  });

  const viewingKey = $derived.by(() => {
    if (!state.viewingKeyId) return null;
    const match = allKeys.find((c) => c.id === state.viewingKeyId);
    return match ? match.apiKey.value : null;
  });

  async function addApiKey() {
    const trimmed = state.keyInput.trim();
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

    state.keyInput = '';
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
        message: ERROR_TITLES[result.error.code],
        description: result.error.userMessage,
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

  function setProvider(provider: AnyProvider) {
    state.selectedProvider = provider;
    state.keyInput = '';
  }

  function setActiveKey(credential: Credential) {
    void applyActiveKey(credential);
  }

  async function applyActiveKey(credential: Credential) {
    if (!deps.currentKeySelectionMode().isManual) {
      const modeError = await deps.setKeySelectionMode(
        KeySelectionMode.manual(),
      );
      if (modeError) {
        deps.toast.show({
          type: 'error',
          message: 'Could not switch to manual key selection',
          description: modeError,
        });
        return;
      }
    }

    const error = await deps.setActiveKey(credential.id);
    if (error) {
      deps.toast.show({
        type: 'error',
        message: 'Could not switch API key',
        description: error,
      });
    }
  }

  function viewKey(credentialId: string) {
    state.viewingKeyId = credentialId;
  }

  function closeViewer() {
    state.viewingKeyId = null;
  }

  function destroy() {
    if (state.pendingDeleteId) {
      void commitPendingDelete();
    } else if (deleteTimer) {
      clearTimeout(deleteTimer);
      deleteTimer = null;
    }
  }

  return {
    state,
    get allKeys() {
      return allKeys;
    },
    get providerKeys() {
      return providerKeys;
    },
    get visibleKeys() {
      return visibleKeys;
    },
    get canAddKey() {
      return canAddKey;
    },
    get viewingKey() {
      return viewingKey;
    },
    addApiKey,
    setProvider,
    requestDelete,
    commitPendingDelete,
    cancelPendingDelete,
    setActiveKey,
    viewKey,
    closeViewer,
    destroy,
  };
}
