import { getCustomProvidersContext } from '../context';
import { ProviderRegistry } from '../../../../../core/domain/provider/ProviderRegistry';
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
}

export function useCustomProviders() {
  const useCases = getCustomProvidersContext();
  const state = new CustomProvidersState();

  function applySnapshot(providers: CustomProviderConfig[]) {
    state.providers = providers;
    ProviderRegistry.syncCustomProviders(
      providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
      })),
    );
  }

  async function hydrate(): Promise<Result<void, AppError>> {
    const result = await useCases.getCustomProviders.execute();
    if (!result.success) {
      return failure(result.error);
    }

    applySnapshot(result.data);
    state.hydrated = true;
    return success(undefined);
  }

  async function save(
    props: CustomProviderConfigProps,
  ): Promise<Result<CustomProviderConfig, AppError>> {
    const result = await useCases.saveCustomProvider.execute(props);
    if (result.success) {
      const refreshed = await useCases.getCustomProviders.execute();
      if (refreshed.success) {
        applySnapshot(refreshed.data);
      }
    }
    return result;
  }

  async function remove(id: string): Promise<Result<void, AppError>> {
    const result = await useCases.removeCustomProvider.execute(id);
    if (result.success) {
      const refreshed = await useCases.getCustomProviders.execute();
      if (refreshed.success) {
        applySnapshot(refreshed.data);
      }
    }
    return result;
  }

  function getProvider(id: string): CustomProviderConfig | null {
    return state.providers.find((provider) => provider.id === id) ?? null;
  }

  hydrate();

  return {
    state,
    hydrate,
    save,
    remove,
    getProvider,
  };
}
