import { getContext, setContext } from 'svelte';
import type { IAddApiKeyUseCase } from '../../../../../core/ports/inbound/auth/IAddApiKeyUseCase';
import type { IRemoveApiKeyUseCase } from '../../../../../core/ports/inbound/auth/IRemoveApiKeyUseCase';
import type { IGetCredentialsUseCase } from '../../../../../core/ports/inbound/auth/IGetCredentialUseCase';
import type { ISetActiveKeyUseCase } from '../../../../../core/ports/inbound/auth/ISetActiveKeyUseCase';
import type { IGetKeySelectionModeUseCase } from '../../../../../core/ports/inbound/auth/IGetKeySelectionModeUseCase';
import type { ISetKeySelectionModeUseCase } from '../../../../../core/ports/inbound/auth/ISetKeySelectionModeUseCase';

const AUTH_CONTEXT_KEY = Symbol('auth');
const AUTH_STATE_KEY = Symbol('authState');

export interface AuthUseCases {
  addApiKey: IAddApiKeyUseCase;
  removeApiKey: IRemoveApiKeyUseCase;
  getCredentials: IGetCredentialsUseCase;
  setActiveKey: ISetActiveKeyUseCase;
  getKeySelectionMode: IGetKeySelectionModeUseCase;
  setKeySelectionMode: ISetKeySelectionModeUseCase;
}

export type AuthStateContext = ReturnType<
  typeof import('../hooks/useAuth.svelte').useAuth
>;

export function setAuthContext(useCases: AuthUseCases): void {
  setContext(AUTH_CONTEXT_KEY, useCases);
}

export function getAuthContext(): AuthUseCases {
  const context = getContext<AuthUseCases>(AUTH_CONTEXT_KEY);
  if (!context) {
    throw new Error(
      'Auth context not found. Did you forget to call setAuthContext?',
    );
  }
  return context;
}

export function setAuthStateContext(authState: AuthStateContext): void {
  setContext(AUTH_STATE_KEY, authState);
}

export function getAuthStateContext(): AuthStateContext {
  const context = getContext<AuthStateContext>(AUTH_STATE_KEY);
  if (!context) {
    throw new Error(
      'AuthState context not found. Did you forget to call setAuthStateContext?',
    );
  }
  return context;
}
