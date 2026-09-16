import { getAuthContext } from '../context';
import { ApiKey } from '../../../../../core/domain/credential/ApiKey';
import type { Credentials } from '../../../../../core/domain/credential/Credentials';
import { KeySelectionMode } from '../../../../../core/domain/credential/KeySelectionMode';
import type { AnyProvider } from '../../../../../core/domain/credential/Provider';

export class AuthState {
  credentials = $state<Credentials | null>(null);
  keySelectionMode = $state<KeySelectionMode>(KeySelectionMode.manual());
  loading = $state(false);
  hasKeys = $derived(
    this.credentials !== null && this.credentials.hasKeys(),
  );
}

export function useAuth() {
  const useCases = getAuthContext();
  const state = new AuthState();

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

  async function setKeySelectionMode(
    mode: KeySelectionMode,
  ): Promise<string | null> {
    const result = await useCases.setKeySelectionMode.execute(mode);
    if (result.success) {
      state.keySelectionMode = mode;
      return null;
    }
    return result.error.message;
  }

  async function addApiKey(
    rawApiKey: string,
    provider: AnyProvider,
  ): Promise<string | null> {
    state.loading = true;

    const apiKeyResult = ApiKey.createWithProvider(rawApiKey, provider);
    if (!apiKeyResult.success) {
      state.loading = false;
      return apiKeyResult.error.message;
    }

    const result = await useCases.addApiKey.execute({
      apiKey: apiKeyResult.data,
    });

    state.loading = false;
    if (result.success) {
      state.credentials = result.data;
      return null;
    }
    return result.error.message;
  }

  async function removeApiKey(credentialId: string): Promise<string | null> {
    state.loading = true;

    const result = await useCases.removeApiKey.execute(credentialId);

    state.loading = false;
    if (result.success) {
      state.credentials = result.data;
      return null;
    }
    return result.error.message;
  }

  async function setActiveKey(credentialId: string): Promise<string | null> {
    if (!state.credentials) return 'No credentials loaded';

    const result = await useCases.setActiveKey.execute(credentialId);
    if (result.success) {
      state.credentials = result.data;
      return null;
    }
    return result.error.message;
  }

  checkAuth();

  return {
    state,
    addApiKey,
    removeApiKey,
    setActiveKey,
    setKeySelectionMode,
  };
}
