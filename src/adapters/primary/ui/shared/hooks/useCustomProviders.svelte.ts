import { getCustomProvidersContext } from '../context';
import { createHydrationLifetime } from './hydration-lifetime';
import type { CustomProviderConfig } from '../../../../../core/domain/provider/CustomProviderConfig';
import type { CustomProviderConfigProps } from '../../../../../core/domain/provider/CustomProviderConfig';
import {
  success,
  failure,
  type Result,
} from '../../../../../shared/types/Result';
import type { AppError } from '../../../../../shared/errors';

export class CustomProvidersState {
  providers = $state<CustomProviderConfig[]>([]);
  hydrated = $state(false);
  hydrationError = $state<string | null>(null);
}

export function useCustomProviders() {
  const useCases = getCustomProvidersContext();
  const state = new CustomProvidersState();
  const lifetime = createHydrationLifetime();

  function applySnapshot(providers: CustomProviderConfig[]) {
    state.providers = providers;
  }

  async function hydrate(): Promise<Result<void, AppError>> {
    const read = lifetime.begin();
    const result = await useCases.getCustomProviders.execute();

    if (!lifetime.isCurrent(read)) return success(undefined);

    if (!result.success) {
      state.hydrationError = result.error.userMessage;

      return failure(result.error);
    }

    applySnapshot(result.data);
    state.hydrated = true;
    state.hydrationError = null;

    return success(undefined);
  }

  async function save(
    props: CustomProviderConfigProps,
  ): Promise<Result<CustomProviderConfig, AppError>> {
    const result = await useCases.saveCustomProvider.execute(props);

    if (result.success && !lifetime.disposed) {
      const refreshed = await useCases.getCustomProviders.execute();

      if (refreshed.success && !lifetime.disposed) {
        applySnapshot(refreshed.data);
      }
    }

    return result;
  }

  async function remove(id: string): Promise<Result<void, AppError>> {
    const result = await useCases.removeCustomProvider.execute(id);

    if (result.success && !lifetime.disposed) {
      applySnapshot(state.providers.filter((provider) => provider.id !== id));
    }

    return result;
  }

  function getProvider(id: string): CustomProviderConfig | null {
    return state.providers.find((provider) => provider.id === id) ?? null;
  }

  return {
    state,
    hydrate,
    save,
    remove,
    getProvider,
    dispose: lifetime.dispose,
  };
}
