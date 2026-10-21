import { AppError } from '../../../../shared/errors';
import type { Result } from '../../../../shared/types/Result';

interface PopupDataSource {
  hydrate(): Promise<Result<void, AppError>>;
}

export interface PopupInitializationDeps {
  auth: PopupDataSource;
  preferences: PopupDataSource;
  customProviders: PopupDataSource;
  models: PopupDataSource;
}

class PopupInitializationState {
  loading = $state(false);
  initialized = $state(false);
  failures = $state<Array<{ name: string; message: string }>>([]);
}

/** Load popup data in order, expose failures, and share an in-flight retry. */
export function createPopupInitializationController(
  deps: PopupInitializationDeps,
) {
  const state = new PopupInitializationState();
  let disposed = false;
  let pending: Promise<void> | undefined;

  async function hydrate(
    name: string,
    participant: PopupDataSource,
  ): Promise<void> {
    try {
      const result = await participant.hydrate();

      if (!result.success && !disposed) {
        state.failures = [
          ...state.failures,
          { name, message: result.error.userMessage },
        ];
      }
    } catch (error) {
      if (!disposed)
        state.failures = [
          ...state.failures,
          { name, message: AppError.fromUnknown(error).userMessage },
        ];
    }
  }

  async function hydrateCatalog(): Promise<void> {
    await hydrate('Custom providers', deps.customProviders);
    if (!disposed) await hydrate('Models', deps.models);
  }

  function initialize(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (pending) return pending;
    state.loading = true;
    state.failures = [];

    pending = Promise.all([
      hydrate('API keys', deps.auth),
      hydrate('Preferences', deps.preferences),
      hydrateCatalog(),
    ])
      .then(() => {
        if (!disposed) {
          state.loading = false;
          state.initialized = true;
        }
      })
      .finally(() => {
        pending = undefined;
      });

    return pending;
  }

  function dispose(): void {
    disposed = true;
  }

  return { state, initialize, dispose };
}
