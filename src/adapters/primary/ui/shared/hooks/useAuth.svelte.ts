import { getAuthContext } from '../context';
import { ApiKey } from '../../../../../core/domain/credential/ApiKey';
import type { Credentials } from '../../../../../core/domain/credential/Credentials';
import { KeySelectionMode } from '../../../../../core/domain/credential/KeySelectionMode';

const ERROR_TIMEOUT_MS = 5000;

export class AuthState {
  credentials = $state<Credentials | null>(null);
  keySelectionMode = $state<KeySelectionMode>(KeySelectionMode.manual());
  loading = $state(false);
  error = $state<string | null>(null);
  isAuthenticated = $derived(
    this.credentials !== null && this.credentials.hasKeys(),
  );
}

export function useAuth() {
  const useCases = getAuthContext();
  const state = new AuthState();
  let errorTimeout: ReturnType<typeof setTimeout> | null = null;

  function setError(message: string) {
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    state.error = message;
    errorTimeout = setTimeout(() => {
      state.error = null;
      errorTimeout = null;
    }, ERROR_TIMEOUT_MS);
  }

  function clearError() {
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      errorTimeout = null;
    }
    state.error = null;
  }

  async function checkAuth() {
    const result = await useCases.getCredentials.execute();
    if (result.success && result.data) {
      state.credentials = result.data;
    }
    await loadKeySelectionMode();
  }

  async function loadKeySelectionMode() {
    const result = await useCases.getKeySelectionMode.execute();
    if (result.success) {
      state.keySelectionMode = result.data;
    }
  }

  async function setKeySelectionMode(mode: KeySelectionMode) {
    const result = await useCases.setKeySelectionMode.execute(mode);
    if (result.success) {
      state.keySelectionMode = mode;
    } else {
      setError(result.error.userMessage);
    }
  }

  async function addApiKey(rawApiKey: string) {
    state.loading = true;
    clearError();

    const apiKeyResult = ApiKey.create(rawApiKey);
    if (!apiKeyResult.success) {
      setError(apiKeyResult.error.message);
      state.loading = false;
      return;
    }

    const result = await useCases.addApiKey.execute({
      apiKey: apiKeyResult.data,
    });

    if (result.success) {
      state.credentials = result.data;
    } else {
      setError(result.error.userMessage);
    }

    state.loading = false;
  }

  async function removeApiKey(credentialId: string) {
    state.loading = true;
    clearError();

    const result = await useCases.removeApiKey.execute(credentialId);

    if (result.success) {
      state.credentials = result.data;
    } else {
      setError(result.error.userMessage);
    }

    state.loading = false;
  }

  async function setActiveKey(credentialId: string) {
    if (!state.credentials) return;

    const result = await useCases.setActiveKey.execute(credentialId);
    if (result.success) {
      state.credentials = result.data;
    }
  }

  async function logout() {
    if (!state.credentials) return;
    const allIds = state.credentials.items.map((c) => c.id);
    for (const id of allIds) {
      const result = await useCases.removeApiKey.execute(id);
      if (result.success) {
        state.credentials = result.data;
      }
    }
  }

  // Check auth status on creation
  checkAuth();

  return {
    state,
    addApiKey,
    removeApiKey,
    setActiveKey,
    setKeySelectionMode,
    logout,
  };
}
