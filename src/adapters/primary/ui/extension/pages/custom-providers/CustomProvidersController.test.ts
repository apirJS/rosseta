import { describe, expect, test, vi, beforeEach } from 'vitest';
import {
  createCustomProvidersController,
  type CustomProvidersDeps,
} from './CustomProvidersController.svelte';
import {
  CustomProviderConfig,
  type CustomProviderConfigProps,
} from '../../../../../../core/domain/provider/CustomProviderConfig';
import { success, failure } from '../../../../../../shared/types/Result';
import { StorageError } from '../../../../../../shared/errors';
import type { PopupToastController } from '../../../shared/toast/PopupToastController.svelte';

function makeConfig(
  overrides: Partial<CustomProviderConfigProps> = {},
): CustomProviderConfig {
  const result = CustomProviderConfig.create({
    id: overrides.id ?? 'custom-test-1',
    name: overrides.name ?? 'OpenRouter',
    baseURL: overrides.baseURL ?? 'https://openrouter.ai/api/v1',
    headers: overrides.headers,
    queryParams: overrides.queryParams,
  });
  if (!result.success) throw new Error('bad config');
  return result.data;
}

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

function createDeps(overrides: Partial<CustomProvidersDeps> = {}) {
  const { toast, show } = createToastFake();
  const providers = [makeConfig()];

  const deps: CustomProvidersDeps = {
    providers: () => providers,
    save: vi.fn().mockImplementation(async (props) =>
      success(makeConfig({ ...props, id: props.id || 'custom-saved' })),
    ),
    remove: vi.fn().mockResolvedValue(success(undefined)),
    toast,
    ...overrides,
  };

  return { deps, show, providers };
}

describe('UI Controller: CustomProvidersController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('starts on the list view exposing providers', () => {
    const { deps } = createDeps();
    const controller = createCustomProvidersController(deps);

    expect(controller.state.view).toBe('list');
    expect(controller.providers).toHaveLength(1);
    expect(controller.providers[0].name).toBe('OpenRouter');
  });

  test('showCreate resets the form for a new provider', () => {
    const { deps } = createDeps();
    const controller = createCustomProvidersController(deps);

    controller.showCreate();

    expect(controller.state.view).toBe('form');
    expect(controller.state.editingId).toBeNull();
    expect(controller.state.name).toBe('');
    expect(controller.state.baseURL).toBe('');
  });

  test('showEdit populates the form from the provider', () => {
    const { deps } = createDeps();
    const controller = createCustomProvidersController(deps);
    const provider = makeConfig({
      headers: { 'X-Test': 'value' },
    });

    controller.showEdit(provider);

    expect(controller.state.view).toBe('form');
    expect(controller.state.editingId).toBe('custom-test-1');
    expect(controller.state.name).toBe('OpenRouter');
    expect(controller.state.baseURL).toBe('https://openrouter.ai/api/v1');
    expect(controller.state.headers).toBe('{\n  "X-Test": "value"\n}');
  });

  test('save builds props with an empty id for new providers', async () => {
    const { deps } = createDeps();
    const controller = createCustomProvidersController(deps);

    controller.showCreate();
    controller.state.name = 'New Endpoint';
    controller.state.baseURL = 'https://api.example.com/v1';
    await controller.save();

    expect(deps.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '',
        name: 'New Endpoint',
        baseURL: 'https://api.example.com/v1',
      }),
    );
    expect(controller.state.view).toBe('list');
  });

  test('save keeps the editing id when updating', async () => {
    const { deps } = createDeps();
    const controller = createCustomProvidersController(deps);
    controller.showEdit(makeConfig());

    controller.state.name = 'Renamed';
    await controller.save();

    expect(deps.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'custom-test-1', name: 'Renamed' }),
    );
  });

  test('save rejects invalid headers JSON without calling storage', async () => {
    const { deps } = createDeps();
    const controller = createCustomProvidersController(deps);

    controller.showCreate();
    controller.state.name = 'X';
    controller.state.baseURL = 'https://api.example.com/v1';
    controller.state.headers = 'not json';
    await controller.save();

    expect(deps.save).not.toHaveBeenCalled();
    expect(controller.state.error).toContain('Headers');
    expect(controller.state.view).toBe('form');
  });

  test('save rejects non-string query param values', async () => {
    const { deps } = createDeps();
    const controller = createCustomProvidersController(deps);

    controller.showCreate();
    controller.state.name = 'X';
    controller.state.baseURL = 'https://api.example.com/v1';
    controller.state.queryParams = '{"limit": 10}';
    await controller.save();

    expect(deps.save).not.toHaveBeenCalled();
    expect(controller.state.error).toContain('Query params');
  });

  test('save shows an error toast and stays on the form on failure', async () => {
    const { deps, show } = createDeps({
      save: vi.fn().mockResolvedValue(
        failure(StorageError.writeFailed('customProviders')),
      ),
    });
    const controller = createCustomProvidersController(deps);

    controller.showCreate();
    controller.state.name = 'X';
    controller.state.baseURL = 'https://api.example.com/v1';
    await controller.save();

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Could Not Save Data',
        description: 'Could not save data.',
      }),
    );
    expect(controller.state.view).toBe('form');
  });

  test('remove delegates by id and shows a toast', async () => {
    const { deps, show } = createDeps();
    const controller = createCustomProvidersController(deps);

    await controller.remove('custom-test-1');

    expect(deps.remove).toHaveBeenCalledWith('custom-test-1');
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', message: 'Provider removed' }),
    );
  });

  test('remove returns to the list when removing the edited provider', async () => {
    const { deps } = createDeps();
    const controller = createCustomProvidersController(deps);
    controller.showEdit(makeConfig());

    await controller.remove('custom-test-1');

    expect(controller.state.view).toBe('list');
  });
});
