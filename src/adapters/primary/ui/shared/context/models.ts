import { getContext, setContext } from 'svelte';
import type { IAddCustomModelUseCase } from '../../../../../core/ports/inbound/models/IAddCustomModelUseCase';
import type { IRemoveCustomModelUseCase } from '../../../../../core/ports/inbound/models/IRemoveCustomModelUseCase';
import type { IClearModelsUseCase } from '../../../../../core/ports/inbound/models/IClearModelsUseCase';
import type { ILoadModelsUseCase } from '../../../../../core/ports/inbound/models/ILoadModelsUseCase';

const MODELS_CONTEXT_KEY = Symbol('models');
const MODELS_STATE_KEY = Symbol('modelsState');

export interface ModelUseCases {
  addCustomModel: IAddCustomModelUseCase;
  removeCustomModel: IRemoveCustomModelUseCase;
  clearModels: IClearModelsUseCase;
  loadModels: ILoadModelsUseCase;
}

export type ModelsStateContext = ReturnType<
  typeof import('../hooks/useModels.svelte').useModels
>;

export function setModelsContext(useCases: ModelUseCases): void {
  setContext(MODELS_CONTEXT_KEY, useCases);
}

export function getModelsContext(): ModelUseCases {
  const context = getContext<ModelUseCases>(MODELS_CONTEXT_KEY);
  if (!context) {
    throw new Error(
      'Models context not found. Did you forget to call setModelsContext?',
    );
  }
  return context;
}

export function setModelsStateContext(modelsState: ModelsStateContext): void {
  setContext(MODELS_STATE_KEY, modelsState);
}

export function getModelsStateContext(): ModelsStateContext {
  const context = getContext<ModelsStateContext>(MODELS_STATE_KEY);
  if (!context) {
    throw new Error(
      'Models state context not found. Did you forget to call setModelsStateContext?',
    );
  }
  return context;
}
