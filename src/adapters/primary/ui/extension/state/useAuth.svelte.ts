import { getAuthContext } from '../context';
import { ApiKey } from '../../../../../core/domain/credential/ApiKey';
import type { Credentials } from '../../../../../core/domain/credential/Credentials';
import { KeySelectionMode } from '../../../../../core/domain/credential/KeySelectionMode';
import type { AnyProvider } from '../../../../../core/domain/credential/Provider';
import { createHydrationLifetime } from './hydration-lifetime';
import {
  failure,
  success,
  type Result,
} from '../../../../../shared/types/Result';
import type { AppError } from '../../../../../shared/errors';

export class AuthState {
  credentials = $state<Credentials | null>(null);
  keySelectionMode = $state<KeySelectionMode>(KeySelectionMode.manual());
  loading = $state(false);
  hydrated = $state(false);
  hydrationError = $state<string | null>(null);
  hasKeys = $derived(this.credentials !== null && this.credentials.hasKeys());
}

export function useAuth() {
  const useCases = getAuthContext();
  const state = new AuthState();
  const lifetime = createHydrationLifetime();

  async function checkAuth(): Promise<Result<void, AppError>> {
    const read = lifetime.begin();
    const result = await useCases.getCredentials.execute();

    if (result.success && lifetime.isCurrent(read)) {
      state.credentials = result.data;
    }

    const mode = await useCases.getKeySelectionMode.execute();

    if (!lifetime.isCurrent(read)) return success(undefined);
    if (mode.success) state.keySelectionMode = mode.data;

    const error = !result.success
      ? result.error
      : !mode.success
        ? mode.error
        : null;

    state.hydrationError = error?.userMessage ?? null;
    if (error) return failure(error);
    state.hydrated = true;

    return success(undefined);
  }

  async function setKeySelectionMode(
    mode: KeySelectionMode,
  ): Promise<string | null> {
    const result = await useCases.setKeySelectionMode.execute(mode);

    if (result.success) {
      state.keySelectionMode = mode;
    }

    return result.success ? null : result.error.message;
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

    if (!lifetime.disposed) state.loading = false;

    if (result.success) {
      state.credentials = result.data;

      return null;
    }

    return result.error.message;
  }

  async function removeApiKey(credentialId: string): Promise<string | null> {
    state.loading = true;

    const result = await useCases.removeApiKey.execute(credentialId);

    if (!lifetime.disposed) state.loading = false;

    if (result.success) {
      // Pending deletions use this snapshot to finish last-key model cleanup,
      // even if their popup has already closed. Hydration uses a separate guard.
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

  return {
    state,
    hydrate: checkAuth,
    addApiKey,
    removeApiKey,
    setActiveKey,
    setKeySelectionMode,
    dispose: lifetime.dispose,
  };
}
