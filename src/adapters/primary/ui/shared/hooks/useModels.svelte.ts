import { getModelsContext } from '../context';
import { sendMessageToRuntime } from '../../../../../shared/messaging';
import type { FetchModelsResponse } from '../../../../../shared/messaging/MessageSchema';
import { AppError, ErrorCode } from '../../../../../shared/errors';
import {
  success,
  failure,
  type Result,
} from '../../../../../shared/types/Result';
import type { StoredModel } from '../../../../../core/ports/outbound/IModelStorage';
import { createHydrationLifetime } from './hydration-lifetime';

export class ModelsState {
  byProvider = $state<Record<string, StoredModel[]>>({});
  hydrated = $state(false);
  hydrationError = $state<string | null>(null);
}

function responseToResult(
  response: FetchModelsResponse,
): Result<StoredModel[], AppError> {
  if (response.success && response.models) {
    return success(response.models);
  }

  return failure(
    new AppError({
      code:
        response.error && response.error.code in ErrorCode
          ? (response.error.code as ErrorCode)
          : ErrorCode.UNKNOWN_ERROR,
      message: response.error?.message ?? 'Failed to fetch models',
      userMessage: response.error?.userMessage,
    }),
  );
}

export function useModels() {
  const useCases = getModelsContext();
  const state = new ModelsState();
  const lifetime = createHydrationLifetime();

  function modelsFor(provider: string): StoredModel[] {
    return state.byProvider[provider] ?? [];
  }

  function setProviderModels(provider: string, models: StoredModel[]) {
    if (lifetime.disposed) return;
    state.byProvider = { ...state.byProvider, [provider]: models };
  }

  async function hydrate(): Promise<Result<void, AppError>> {
    const read = lifetime.begin();
    const result = await useCases.loadModels.executeAll();

    if (!lifetime.isCurrent(read)) return success(undefined);

    if (!result.success) {
      state.hydrationError = result.error.userMessage;

      return failure(result.error);
    }

    state.byProvider = result.data;
    state.hydrationError = null;
    state.hydrated = true;

    return success(undefined);
  }

  async function fetchModels(
    provider: string,
  ): Promise<Result<StoredModel[], AppError>> {
    const response = await sendMessageToRuntime({
      action: 'FETCH_MODELS',
      payload: { provider },
    });

    const result = responseToResult(response);

    if (result.success) {
      setProviderModels(provider, result.data);
    }

    return result;
  }

  async function addCustomModel(
    provider: string,
    modelId: string,
  ): Promise<Result<StoredModel[], AppError>> {
    const result = await useCases.addCustomModel.execute(provider, modelId);

    if (result.success) {
      setProviderModels(provider, result.data);
    }

    return result;
  }

  async function removeCustomModel(
    provider: string,
    modelId: string,
  ): Promise<Result<StoredModel[], AppError>> {
    const result = await useCases.removeCustomModel.execute(provider, modelId);

    if (result.success) {
      setProviderModels(provider, result.data);
    }

    return result;
  }

  async function clearModels(
    provider: string,
  ): Promise<Result<void, AppError>> {
    const result = await useCases.clearModels.execute(provider);

    if (result.success) {
      setProviderModels(provider, []);
    }

    return result;
  }

  return {
    state,
    modelsFor,
    hydrate,
    fetchModels,
    addCustomModel,
    removeCustomModel,
    clearModels,
    dispose: lifetime.dispose,
  };
}
