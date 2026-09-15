import { describe, expect, test, vi, beforeEach } from 'vitest';
import {
  createManageModelsController,
  type ManageModelsDeps,
} from './ManageModelsController.svelte';
import type { StoredModel } from '../../../../../../core/ports/outbound/IModelStorage';
import { success, failure } from '../../../../../../shared/types/Result';
import { ValidationError } from '../../../../../../shared/errors';
import type { PopupToastController } from '../../../shared/toast/PopupToastController.svelte';

function createToastFake() {
  const show = vi.fn();
  const toast = {
    show,
    dismiss: vi.fn(),
    update: vi.fn(),
    toasts: [],
  } as unknown as PopupToastController;
  return { toast, show };
}

function createDeps(overrides: Partial<ManageModelsDeps> = {}) {
  const { toast, show } = createToastFake();

  const deps: ManageModelsDeps = {
    modelsFor: vi.fn().mockReturnValue([
      { id: 'm1', name: 'Model 1', source: 'fetched' as const },
      { id: 'm2', name: 'Model 2', source: 'manual' as const },
    ]),
    addModel: vi.fn().mockResolvedValue(
      success<StoredModel[]>([
        { id: 'm1', name: 'Model 1', source: 'fetched' },
      ]),
    ),
    removeModel: vi.fn().mockResolvedValue(success<StoredModel[]>([])),
    clearModels: vi.fn().mockResolvedValue(success(undefined)),
    fetchModels: vi.fn().mockResolvedValue(
      success<StoredModel[]>([
        { id: 'm1', name: 'Model 1', source: 'fetched' },
      ]),
    ),
    hasApiKeyFor: vi.fn().mockReturnValue(true),
    selectedModelFor: vi.fn().mockReturnValue(undefined),
    selectModel: vi.fn(),
    toast,
    ...overrides,
  };

  return { deps, show };
}

describe('UI Controller: ManageModelsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('exposes models for the selected provider', () => {
    const { deps } = createDeps();
    const controller = createManageModelsController(deps);

    expect(controller.models).toHaveLength(2);
    expect(controller.models[1].source).toBe('manual');
  });

  test('setProvider resets the model input', () => {
    const { deps } = createDeps();
    const controller = createManageModelsController(deps);
    controller.state.modelInput = 'pending-text';

    controller.setProvider('groq');

    expect(controller.state.selectedProvider).toBe('groq');
    expect(controller.state.modelInput).toBe('');
  });

  test('addModel succeeds and clears the input', async () => {
    const { deps } = createDeps();
    const controller = createManageModelsController(deps);
    controller.state.modelInput = 'new-model';

    await controller.addModel();

    expect(deps.addModel).toHaveBeenCalledWith('google', 'new-model');
    expect(controller.state.modelInput).toBe('');
  });

  test('addModel with empty input does nothing', async () => {
    const { deps } = createDeps();
    const controller = createManageModelsController(deps);

    await controller.addModel();

    expect(deps.addModel).not.toHaveBeenCalled();
  });

  test('filteredModels returns all models when input is empty', () => {
    const { deps } = createDeps();
    const controller = createManageModelsController(deps);

    expect(controller.filteredModels).toHaveLength(2);
  });

  test('filteredModels matches by id or name case-insensitively', () => {
    const { deps } = createDeps();
    const controller = createManageModelsController(deps);

    controller.state.modelInput = 'M1';
    expect(controller.filteredModels.map((m) => m.id)).toEqual(['m1']);

    controller.state.modelInput = 'model 2';
    expect(controller.filteredModels.map((m) => m.id)).toEqual(['m2']);

    controller.state.modelInput = 'nothing-matches';
    expect(controller.filteredModels).toHaveLength(0);
  });

  test('canAddModel is false for empty input and exact existing ids', () => {
    const { deps } = createDeps();
    const controller = createManageModelsController(deps);

    expect(controller.canAddModel).toBe(false);

    controller.state.modelInput = 'brand-new-model';
    expect(controller.canAddModel).toBe(true);

    controller.state.modelInput = 'm1';
    expect(controller.canAddModel).toBe(false);
  });

  test('addModel no-ops when the input matches an existing model id', async () => {
    const { deps } = createDeps();
    const controller = createManageModelsController(deps);
    controller.state.modelInput = 'm1';

    await controller.addModel();

    expect(deps.addModel).not.toHaveBeenCalled();
    expect(controller.state.modelInput).toBe('m1');
  });

  test('addModel failure shows an error toast', async () => {
    const { deps, show } = createDeps({
      addModel: vi.fn().mockResolvedValue(
        failure(ValidationError.invalidInput('Storage broken')),
      ),
    });
    const controller = createManageModelsController(deps);
    controller.state.modelInput = 'new-model';

    await controller.addModel();

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Could not add model',
        description: 'Storage broken',
      }),
    );
    expect(controller.state.modelInput).toBe('new-model');
  });

  test('removeModel failure shows an error toast', async () => {
    const { deps, show } = createDeps({
      removeModel: vi
        .fn()
        .mockResolvedValue(failure(ValidationError.invalidInput('nope'))),
    });
    const controller = createManageModelsController(deps);

    await controller.removeModel('m1');

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: 'Could not remove model' }),
    );
  });

  test('fetchModels without a key shows an info toast and does not fetch', async () => {
    const { deps, show } = createDeps({ hasApiKeyFor: vi.fn().mockReturnValue(false) });
    const controller = createManageModelsController(deps);

    await controller.fetchModels();

    expect(deps.fetchModels).not.toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'info' }),
    );
  });

  test('fetchModels success shows a toast with the model count', async () => {
    const { deps, show } = createDeps();
    const controller = createManageModelsController(deps);

    await controller.fetchModels();

    expect(deps.fetchModels).toHaveBeenCalledWith('google');
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', message: 'Loaded 1 models' }),
    );
    expect(controller.state.isFetching).toBe(false);
  });

  test('fetchModels failure shows an error toast', async () => {
    const { deps, show } = createDeps({
      fetchModels: vi
        .fn()
        .mockResolvedValue(failure(ValidationError.invalidInput('401 Unauthorized'))),
    });
    const controller = createManageModelsController(deps);

    await controller.fetchModels();

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Could not fetch models',
        description: '401 Unauthorized',
      }),
    );
  });

  test('resetModels delegates to clearModels', async () => {
    const { deps } = createDeps();
    const controller = createManageModelsController(deps);

    await controller.resetModels();

    expect(deps.clearModels).toHaveBeenCalledWith('google');
  });

  test('resetModels failure shows an error toast', async () => {
    const { deps, show } = createDeps({
      clearModels: vi
        .fn()
        .mockResolvedValue(failure(ValidationError.invalidInput('denied'))),
    });
    const controller = createManageModelsController(deps);

    await controller.resetModels();

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: 'Could not reset models' }),
    );
  });

  test('exposes the selected model for the active provider', () => {
    const { deps } = createDeps({
      selectedModelFor: vi.fn().mockReturnValue('m2'),
    });
    const controller = createManageModelsController(deps);

    expect(controller.selectedModelId).toBe('m2');
  });

  test('selectModel delegates with the selected provider', () => {
    const { deps } = createDeps();
    const controller = createManageModelsController(deps);
    controller.setProvider('groq');

    controller.selectModel('m1');

    expect(deps.selectModel).toHaveBeenCalledWith('groq', 'm1');
  });
});
