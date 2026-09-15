import type { StoredModel } from '../../../../../../core/ports/outbound/IModelStorage';
import type { Result } from '../../../../../../shared/types/Result';
import type { AppError } from '../../../../../../shared/errors';
import type { PopupToastController } from '../../../shared/toast/PopupToastController.svelte';

class ManageModelsState {
  selectedProvider = $state<string>('google');
  modelInput = $state('');
  isFetching = $state(false);
}

export interface ManageModelsDeps {
  modelsFor: (provider: string) => StoredModel[];
  addModel: (
    provider: string,
    modelId: string,
  ) => Promise<Result<StoredModel[], AppError>>;
  removeModel: (
    provider: string,
    modelId: string,
  ) => Promise<Result<StoredModel[], AppError>>;
  clearModels: (provider: string) => Promise<Result<void, AppError>>;
  fetchModels: (
    provider: string,
  ) => Promise<Result<StoredModel[], AppError>>;
  hasApiKeyFor: (provider: string) => boolean;
  selectedModelFor: (provider: string) => string | undefined;
  selectModel: (provider: string, modelId: string) => void;
  toast: PopupToastController;
}

export function createManageModelsController(deps: ManageModelsDeps) {
  const state = new ManageModelsState();

  const models = $derived(deps.modelsFor(state.selectedProvider));
  const selectedModelId = $derived(
    deps.selectedModelFor(state.selectedProvider),
  );

  const filteredModels = $derived.by(() => {
    const query = state.modelInput.trim().toLowerCase();
    if (!query) return models;
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(query) ||
        m.name.toLowerCase().includes(query),
    );
  });

  const canAddModel = $derived.by(() => {
    const id = state.modelInput.trim();
    return id !== '' && !models.some((m) => m.id === id);
  });

  function setProvider(provider: string) {
    state.selectedProvider = provider;
    state.modelInput = '';
  }

  async function addModel() {
    const id = state.modelInput.trim();
    if (!id || !canAddModel) return;

    const result = await deps.addModel(state.selectedProvider, id);
    if (result.success) {
      state.modelInput = '';
    } else {
      deps.toast.show({
        type: 'error',
        message: 'Could not add model',
        description: result.error.message,
      });
    }
  }

  async function removeModel(modelId: string) {
    const result = await deps.removeModel(state.selectedProvider, modelId);
    if (!result.success) {
      deps.toast.show({
        type: 'error',
        message: 'Could not remove model',
        description: result.error.message,
      });
    }
  }

  async function fetchModels() {
    if (!deps.hasApiKeyFor(state.selectedProvider)) {
      deps.toast.show({
        type: 'info',
        message: 'No API key for this provider',
        description: 'Add a key under Manage API Keys first.',
      });
      return;
    }

    state.isFetching = true;
    const result = await deps.fetchModels(state.selectedProvider);
    state.isFetching = false;

    if (result.success) {
      deps.toast.show({
        type: 'success',
        message: `Loaded ${result.data.length} models`,
      });
    } else {
      deps.toast.show({
        type: 'error',
        message: 'Could not fetch models',
        description: result.error.message,
      });
    }
  }

  async function resetModels() {
    const result = await deps.clearModels(state.selectedProvider);
    if (!result.success) {
      deps.toast.show({
        type: 'error',
        message: 'Could not reset models',
        description: result.error.message,
      });
    }
  }

  function selectModel(modelId: string) {
    deps.selectModel(state.selectedProvider, modelId);
  }

  return {
    state,
    get models() {
      return models;
    },
    get filteredModels() {
      return filteredModels;
    },
    get canAddModel() {
      return canAddModel;
    },
    get selectedModelId() {
      return selectedModelId;
    },
    setProvider,
    addModel,
    removeModel,
    selectModel,
    fetchModels,
    resetModels,
  };
}
