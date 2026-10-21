import type { PopupToastController } from '../../toast/PopupToastController.svelte';

interface ApiKeyViewerDeps {
  copyText: (value: string) => Promise<void>;
  toast: Pick<PopupToastController, 'show'>;
}

/** Owns the revealed key and its temporary clipboard feedback. */
export function createApiKeyViewerController(deps: ApiKeyViewerDeps) {
  const state = $state({ apiKey: null as string | null, copied: false });
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;

  function close() {
    revision++;
    clearTimeout(feedbackTimer);
    feedbackTimer = undefined;
    state.apiKey = null;
    state.copied = false;
  }

  function open(apiKey: string) {
    close();
    state.apiKey = apiKey;
  }

  async function copy() {
    if (state.apiKey === null) return;

    const current = ++revision;
    const apiKey = state.apiKey;

    try {
      await deps.copyText(apiKey);
      if (current !== revision) return;
      clearTimeout(feedbackTimer);
      state.copied = true;

      feedbackTimer = setTimeout(() => {
        state.copied = false;
        feedbackTimer = undefined;
      }, 1500);
    } catch {
      if (current !== revision) return;

      deps.toast.show({
        type: 'error',
        message: 'Could not copy API key',
        description: 'Select the key text and copy it manually.',
      });
    }
  }

  return { state, open, close, copy };
}
