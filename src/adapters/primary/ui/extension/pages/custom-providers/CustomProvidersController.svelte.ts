import type { Result } from '../../../../../../shared/types/Result';
import { ERROR_TITLES, type AppError } from '../../../../../../shared/errors';
import type {
  CustomProviderConfig,
  CustomProviderConfigProps,
  CustomProviderType,
} from '../../../../../../core/domain/provider/CustomProviderConfig';
import type { PopupToastController } from '../../../shared/toast/PopupToastController.svelte';

export type CustomProvidersSubView = 'list' | 'form';

class CustomProvidersState {
  view = $state<CustomProvidersSubView>('list');
  editingId = $state<string | null>(null);
  name = $state('');
  type = $state<CustomProviderType>('openai-compatible');
  baseURL = $state('');
  headers = $state('');
  queryParams = $state('');
  error = $state<string | null>(null);
  isSaving = $state(false);
}

export interface CustomProvidersDeps {
  providers: () => CustomProviderConfig[];
  save: (
    props: CustomProviderConfigProps,
  ) => Promise<Result<CustomProviderConfig, AppError>>;
  remove: (id: string) => Promise<Result<void, AppError>>;
  toast: PopupToastController;
}

function parseStringRecordJson(
  value: string,
): Record<string, string> | undefined | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return 'invalid';
    }
    for (const entryValue of Object.values(parsed)) {
      if (typeof entryValue !== 'string') return 'invalid';
    }
    return parsed as Record<string, string>;
  } catch {
    return 'invalid';
  }
}

export function createCustomProvidersController(
  deps: CustomProvidersDeps,
) {
  const state = new CustomProvidersState();

  const providers = $derived(deps.providers());

  function showList() {
    state.view = 'list';
    state.editingId = null;
    state.error = null;
  }

  function showCreate() {
    state.view = 'form';
    state.editingId = null;
    state.name = '';
    state.type = 'openai-compatible';
    state.baseURL = '';
    state.headers = '';
    state.queryParams = '';
    state.error = null;
  }

  function showEdit(provider: CustomProviderConfig) {
    state.view = 'form';
    state.editingId = provider.id;
    state.name = provider.name;
    state.type = provider.type;
    state.baseURL = provider.baseURL;
    state.headers = provider.headers
      ? JSON.stringify(provider.headers, null, 2)
      : '';
    state.queryParams = provider.queryParams
      ? JSON.stringify(provider.queryParams, null, 2)
      : '';
    state.error = null;
  }

  async function save() {
    state.error = null;

    const headers = parseStringRecordJson(state.headers);
    if (headers === 'invalid') {
      state.error = 'Headers must be a JSON object of strings.';
      return;
    }

    const queryParams = parseStringRecordJson(state.queryParams);
    if (queryParams === 'invalid') {
      state.error = 'Query params must be a JSON object of strings.';
      return;
    }

    const props: CustomProviderConfigProps = {
      id: state.editingId ?? '',
      name: state.name,
      type: state.type,
      baseURL: state.baseURL,
      headers,
      queryParams,
    };

    state.isSaving = true;
    const result = await deps.save(props);
    state.isSaving = false;

    if (!result.success) {
      state.error = result.error.message;
      deps.toast.show({
        type: 'error',
        message: ERROR_TITLES[result.error.code],
        description: result.error.userMessage,
      });
      return;
    }

    deps.toast.show({
      type: 'success',
      message: state.editingId
        ? 'Provider updated'
        : `Provider "${result.data.name}" added`,
    });
    showList();
  }

  async function remove(id: string) {
    const result = await deps.remove(id);
    if (!result.success) {
      deps.toast.show({
        type: 'error',
        message: ERROR_TITLES[result.error.code],
        description: result.error.userMessage,
      });
      return;
    }

    deps.toast.show({ type: 'success', message: 'Provider removed' });
    if (state.editingId === id) {
      showList();
    }
  }

  return {
    state,
    get providers() {
      return providers;
    },
    showList,
    showCreate,
    showEdit,
    save,
    remove,
  };
}
