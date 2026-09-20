import { maskApiKey } from '../../../../shared/utils';
import type { Credential } from '../../../../../../../core/domain/credential/Credential';
import type { Credentials } from '../../../../../../../core/domain/credential/Credentials';
import type { AnyProvider } from '../../../../../../../core/domain/credential/Provider';
import { KeySelectionMode } from '../../../../../../../core/domain/credential/KeySelectionMode';
import type { PopupToastController } from '../../../../shared/toast/PopupToastController.svelte';

export interface ActiveKeyIndicatorDeps {
  getProvider: () => AnyProvider;
  getCredential: () => Credential | null;
  auth: {
    state: { credentials: Credentials | null; keySelectionMode: KeySelectionMode };
    setActiveKey: (credentialId: string) => Promise<string | null>;
    setKeySelectionMode: (
      mode: KeySelectionMode,
    ) => Promise<string | null>;
  };
  toast: Pick<PopupToastController, 'show'>;
}

class ActiveKeyIndicatorState {
  isOpen = $state(false);
}

function getDisplayLabel(credential: Credential): string {
  return maskApiKey(credential.apiKey.value);
}

export function createActiveKeyIndicatorController(
  deps: ActiveKeyIndicatorDeps,
) {
  const state = new ActiveKeyIndicatorState();

  const providerCredentials = $derived.by(() =>
    (deps.auth.state.credentials?.items ?? []).filter(
      (c) => c.provider === deps.getProvider(),
    ),
  );

  const hasMultiple = $derived(providerCredentials.length > 1);

  const currentMode = $derived(deps.auth.state.keySelectionMode);

  const providerActive = $derived.by(() => {
    const credential = deps.getCredential();
    return credential && credential.provider === deps.getProvider()
      ? credential
      : null;
  });

  const autoBalanceProviders = $derived(
    providerCredentials.length >= 2 ? [deps.getProvider()] : [],
  );

  /**
   * Mirrors `ResolveActiveCredentialUseCase`, which silently falls back to
   * manual when the auto-balance provider has fewer than 2 keys. Without the
   * same guard the trigger would advertise "Auto ⟳" for a mode the background
   * is no longer honouring — e.g. after the user deletes one of two keys.
   */
  const isAutoBalanceActive = $derived(
    currentMode.isAutoBalance &&
      currentMode.autoBalanceProvider === deps.getProvider() &&
      hasMultiple,
  );

  function getTriggerLabel(): string {
    if (isAutoBalanceActive) return 'Auto ⟳';
    if (providerActive) return getDisplayLabel(providerActive);
    return '—';
  }

  function toggle() {
    state.isOpen = !state.isOpen;
  }

  function close() {
    state.isOpen = false;
  }

  async function selectKey(cred: Credential) {
    if (!currentMode.isManual) {
      const modeError = await deps.auth.setKeySelectionMode(
        KeySelectionMode.manual(),
      );
      if (modeError) {
        deps.toast.show({
          type: 'error',
          message: 'Could not switch to manual key selection',
          description: modeError,
        });
        return;
      }
    }
    const error = await deps.auth.setActiveKey(cred.id);
    if (error) {
      deps.toast.show({
        type: 'error',
        message: 'Could not switch API key',
        description: error,
      });
      return;
    }
    state.isOpen = false;
  }

  async function selectAutoBalance(targetProvider: AnyProvider) {
    const error = await deps.auth.setKeySelectionMode(
      KeySelectionMode.autoBalance(targetProvider),
    );
    if (error) {
      deps.toast.show({
        type: 'error',
        message: 'Could not enable auto-balance',
        description: error,
      });
    }
    state.isOpen = false;
  }

  return {
    state,
    get providerCredentials(): Credential[] {
      return providerCredentials;
    },
    get hasMultiple(): boolean {
      return hasMultiple;
    },
    get currentMode(): KeySelectionMode {
      return currentMode;
    },
    get providerActive(): Credential | null {
      return providerActive;
    },
    get autoBalanceProviders(): AnyProvider[] {
      return autoBalanceProviders;
    },
    getDisplayLabel,
    getTriggerLabel,
    toggle,
    close,
    selectKey,
    selectAutoBalance,
  };
}
