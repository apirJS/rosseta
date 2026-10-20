import { AppError } from '../../../../shared/errors';
import type { Result } from '../../../../shared/types/Result';

interface PopupParticipant {
  hydrate(): Promise<Result<void, AppError>>;
  dispose(): void;
}

export interface PopupLifecycleDeps {
  auth: PopupParticipant;
  preferences: PopupParticipant;
  customProviders: PopupParticipant;
  models: PopupParticipant;
  disposeFeedback(): void;
}

class PopupInitializationState {
  loading = $state(false);
  initialized = $state(false);
  failures = $state<Array<{ name: string; message: string }>>([]);
}

/** Own popup initialization ordering and teardown; hooks own their snapshots. */
export function createPopupLifecycle(deps: PopupLifecycleDeps) {
  const state = new PopupInitializationState();
  let disposed = false;
  let pending: Promise<void> | undefined;

  async function hydrate(
    name: string,
    participant: PopupParticipant,
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
    if (disposed) return;
    disposed = true;
    for (const participant of [
      deps.auth,
      deps.preferences,
      deps.models,
      deps.customProviders,
    ])
      participant.dispose();
    deps.disposeFeedback();
  }

  return { state, initialize, dispose };
}
