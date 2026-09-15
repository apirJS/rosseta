import { getContext, setContext } from 'svelte';
import type { IGetCustomProvidersUseCase } from '../../../../../core/ports/inbound/provider/IGetCustomProvidersUseCase';
import type { ISaveCustomProviderUseCase } from '../../../../../core/ports/inbound/provider/ISaveCustomProviderUseCase';
import type { IRemoveCustomProviderUseCase } from '../../../../../core/ports/inbound/provider/IRemoveCustomProviderUseCase';

const CUSTOM_PROVIDERS_CONTEXT_KEY = Symbol('customProviders');
const CUSTOM_PROVIDERS_STATE_KEY = Symbol('customProvidersState');

export interface CustomProviderUseCases {
  getCustomProviders: IGetCustomProvidersUseCase;
  saveCustomProvider: ISaveCustomProviderUseCase;
  removeCustomProvider: IRemoveCustomProviderUseCase;
}

export type CustomProvidersStateContext = ReturnType<
  typeof import('../hooks/useCustomProviders.svelte').useCustomProviders
>;

export function setCustomProvidersContext(
  useCases: CustomProviderUseCases,
): void {
  setContext(CUSTOM_PROVIDERS_CONTEXT_KEY, useCases);
}

export function getCustomProvidersContext(): CustomProviderUseCases {
  const context = getContext<CustomProviderUseCases>(
    CUSTOM_PROVIDERS_CONTEXT_KEY,
  );
  if (!context) {
    throw new Error(
      'Custom providers context not found. Did you forget to call setCustomProvidersContext?',
    );
  }
  return context;
}

export function setCustomProvidersStateContext(
  state: CustomProvidersStateContext,
): void {
  setContext(CUSTOM_PROVIDERS_STATE_KEY, state);
}

export function getCustomProvidersStateContext(): CustomProvidersStateContext {
  const context = getContext<CustomProvidersStateContext>(
    CUSTOM_PROVIDERS_STATE_KEY,
  );
  if (!context) {
    throw new Error(
      'Custom providers state context not found. Did you forget to call setCustomProvidersStateContext?',
    );
  }
  return context;
}
