import type { AnyProvider } from '../../../../../../core/domain/credential/Provider';
import type { Credential } from '../../../../../../core/domain/credential/Credential';
import type { Credentials } from '../../../../../../core/domain/credential/Credentials';
import { KeySelectionMode } from '../../../../../../core/domain/credential/KeySelectionMode';
import type { StoredModel } from '../../../../../../core/ports/outbound/IModelStorage';
import type { Result } from '../../../../../../shared/types/Result';
import { ERROR_TITLES, type AppError } from '../../../../../../shared/errors';
import type { PopupToastController } from '../../toast/PopupToastController.svelte';

const UNDO_WINDOW_MS = 5000;

class ManageKeysState {
  selectedProvider = $state<AnyProvider>('google');
  keyInput = $state('');
  pendingDeleteId = $state<string | null>(null);
}

export interface ManageKeysDeps {
  credentials: () => Credentials | null;
  addApiKey: (rawKey: string, provider: AnyProvider) => Promise<string | null>;
  removeApiKey: (credentialId: string) => Promise<string | null>;
  setActiveKey: (credentialId: string) => Promise<string | null>;
  currentKeySelectionMode: () => KeySelectionMode;
  setKeySelectionMode: (mode: KeySelectionMode) => Promise<string | null>;
  modelsFor: (provider: string) => StoredModel[];
  fetchModels: (provider: string) => Promise<Result<StoredModel[], AppError>>;
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
  let committingDeleteIds = $state<string[]>([]);
  let deleteQueue: Promise<void> = Promise.resolve();

  const allKeys = $derived(deps.credentials()?.items ?? []);

  const providerKeys = $derived(
    allKeys.filter((c) => c.provider === state.selectedProvider),
  );

  const visibleKeys = $derived.by(() => {
    const pending = state.pendingDeleteId;

    const base = providerKeys.filter(
      (c) => c.id !== pending && !committingDeleteIds.includes(c.id),
    );

    const query = state.keyInput.trim().toLowerCase();

    if (!query) return base;

    return base.filter((c) => c.apiKey.value.toLowerCase().includes(query));
  });

  const canAddKey = $derived.by(() => {
    const key = state.keyInput.trim();

    return key !== '' && !allKeys.some((c) => c.apiKey.value === key);
  });

  async function addApiKey() {
    const trimmed = state.keyInput.trim();
    const provider = state.selectedProvider;

    if (!trimmed) return;

    if (allKeys.some((c) => c.apiKey.value === trimmed)) {
      deps.toast.show({
        type: 'error',
        message: 'Key already added',
        description: 'This API key is already in your list.',
      });

      return;
    }

    const error = await deps.addApiKey(trimmed, provider);

    if (error) {
      deps.toast.show({
        type: 'error',
        message: 'Could not add key',
        description: error,
      });

      return;
    }

    if (
      state.selectedProvider === provider &&
      state.keyInput.trim() === trimmed
    )
      state.keyInput = '';
    deps.toast.show({ type: 'success', message: 'API key added' });

    if (deps.modelsFor(provider).length === 0) {
      void autoFetchModels(provider);
    }
  }

  async function autoFetchModels(provider: AnyProvider) {
    let result: Result<StoredModel[], AppError>;

    try {
      result = await deps.fetchModels(provider);
    } catch {
      deps.toast.show({
        type: 'error',
        message: 'Could not fetch models',
        description:
          'Your API key was saved. Try Fetch Models under Manage Models.',
      });

      return;
    }

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
    if (
      state.pendingDeleteId === credentialId ||
      committingDeleteIds.includes(credentialId)
    )
      return;
    void commitPendingDelete();
    state.pendingDeleteId = credentialId;

    deleteTimer = setTimeout(() => {
      void commitPendingDelete();
    }, UNDO_WINDOW_MS);
  }

  function commitPendingDelete(): Promise<void> {
    const id = state.pendingDeleteId;

    if (!id) return deleteQueue;

    committingDeleteIds = [...committingDeleteIds, id];
    cancelPendingDelete();

    // Credential removal saves the complete collection; serialize writes so
    // rapid deletes cannot overwrite another deletion with an older snapshot.
    deleteQueue = deleteQueue
      .then(() => persistDelete(id))
      .catch((error: unknown) => {
        showDeleteError(
          error instanceof Error
            ? error.message
            : 'Please try deleting the key again.',
        );
      })
      .finally(() => {
        committingDeleteIds = committingDeleteIds.filter(
          (keyId) => keyId !== id,
        );
      });

    return deleteQueue;
  }

  async function persistDelete(id: string) {
    const error = await deps.removeApiKey(id);

    if (error) {
      showDeleteError(error);

      return;
    }

    const remaining = deps.credentials();

    if (!remaining || remaining.items.length === 0) {
      await deps.clearAllModels();
    }
  }

  function showDeleteError(description: string) {
    deps.toast.show({
      type: 'error',
      message: 'Could not delete key',
      description,
    });
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

  function destroy() {
    void commitPendingDelete();
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
    addApiKey,
    setProvider,
    requestDelete,
    commitPendingDelete,
    cancelPendingDelete,
    setActiveKey,
    destroy,
  };
}
