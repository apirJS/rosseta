import {
  DEFAULT_PROVIDER,
  isAnyProvider,
  type AnyProvider,
} from '../../../../../../core/domain/credential/Provider';
import { KeySelectionMode } from '../../../../../../core/domain/credential/KeySelectionMode';
import type { Credential } from '../../../../../../core/domain/credential/Credential';
import type { Credentials } from '../../../../../../core/domain/credential/Credentials';
import { isCustomProviderId } from '../../../../../../core/domain/provider/CustomProviderConfig';
import { ProviderRegistry } from '../../../../../../core/domain/provider/ProviderRegistry';
import type { StoredModel } from '../../../../../../core/ports/outbound/IModelStorage';
import type { PopupToastController } from '../../../shared/toast/PopupToastController.svelte';

export interface MainPageDeps {
  auth: {
    state: { credentials: Credentials | null; keySelectionMode: KeySelectionMode };
    setActiveKey: (credentialId: string) => Promise<string | null>;
    setKeySelectionMode: (
      mode: KeySelectionMode,
    ) => Promise<string | null>;
  };
  preferences: {
    state: { selectedModels: Record<string, string> };
    setSelectedModelFor: (provider: string, modelId: string) => void;
  };
  models: { modelsFor: (provider: string) => StoredModel[] };
  customProviders: {
    getProvider: (id: string) => { id: string } | null;
  };
  toast: Pick<PopupToastController, 'show'>;
}

class MainPageState {
  selectedProvider = $state<AnyProvider | null>(null);
}

export function createMainPageController(deps: MainPageDeps) {
  const state = new MainPageState();

  const activeCredential = $derived(
    deps.auth.state.credentials?.getActive() ?? null,
  );

  /**
   * The provider auto-balance is actually rotating over, or null.
   *
   * Deliberately mirrors `ResolveActiveCredentialUseCase`, which falls back to
   * the manually-active credential whenever the stored auto-balance provider
   * has fewer than 2 keys. Trusting the stored mode alone would let the popup
   * show (and pick a model for) one provider while the background translates
   * with the active credential of another.
   */
  const effectiveAutoBalanceProvider = $derived.by(() => {
    const mode = deps.auth.state.keySelectionMode;
    if (!mode.isAutoBalance) return null;

    const provider = mode.autoBalanceProvider;
    if (!provider) return null;

    const keys = deps.auth.state.credentials?.getByProvider(provider) ?? [];
    return keys.length >= 2 ? provider : null;
  });

  const activeProvider = $derived(
    effectiveAutoBalanceProvider ??
      activeCredential?.provider ??
      DEFAULT_PROVIDER,
  );

  const effectiveProvider = $derived(state.selectedProvider ?? activeProvider);

  const providerKeys = $derived(
    deps.auth.state.credentials?.getByProvider(effectiveProvider) ?? [],
  );

  const providerModels = $derived(deps.models.modelsFor(effectiveProvider));

  const effectiveModelId = $derived.by(() => {
    const saved = deps.preferences.state.selectedModels[effectiveProvider];
    if (saved && providerModels.some((m) => m.id === saved)) return saved;

    const defaultId = ProviderRegistry.getDefaultModelId(effectiveProvider);
    if (defaultId && providerModels.some((m) => m.id === defaultId)) {
      return defaultId;
    }
    return providerModels[0]?.id ?? '';
  });

  const canTranslate = $derived(
    providerKeys.length > 0 && effectiveModelId !== '',
  );

  $effect(() => {
    if (!canTranslate) return;
    if (
      deps.preferences.state.selectedModels[effectiveProvider] !==
      effectiveModelId
    ) {
      void deps.preferences.setSelectedModelFor(
        effectiveProvider,
        effectiveModelId,
      );
    }
  });

  $effect(() => {
    const credentials = deps.auth.state.credentials;
    if (!credentials) return;

    const keys = credentials.getByProvider(effectiveProvider);
    if (keys.length === 0) return;

    // Only skip the active-key sync while auto-balance is genuinely rotating;
    // a stale mode must still pin an active key for the shown provider.
    if (effectiveAutoBalanceProvider === effectiveProvider) return;

    const active = credentials.getActive();
    if (active && active.provider === effectiveProvider) return;

    void deps.auth.setActiveKey(keys[0].id);
  });
  $effect(() => {
    if (
      state.selectedProvider !== null &&
      isCustomProviderId(state.selectedProvider) &&
      !deps.customProviders.getProvider(state.selectedProvider)
    ) {
      state.selectedProvider = null;
    }
  });

  function revertProviderSelection(previous: AnyProvider, error: string) {
    state.selectedProvider = previous === activeProvider ? null : previous;
    deps.toast.show({
      type: 'error',
      message: 'Could not switch provider',
      description: error,
    });
  }

  async function changeProvider(newValue: string): Promise<void> {
    if (!isAnyProvider(newValue) || newValue === effectiveProvider) return;

    const previous = effectiveProvider;
    state.selectedProvider = newValue;

    const candidates =
      deps.auth.state.credentials?.getByProvider(newValue) ?? [];
    if (candidates.length === 0) return;

    if (!deps.auth.state.keySelectionMode.isManual) {
      const modeError = await deps.auth.setKeySelectionMode(
        KeySelectionMode.manual(),
      );
      if (modeError) {
        revertProviderSelection(previous, modeError);
        return;
      }
    }

    const error = await deps.auth.setActiveKey(candidates[0].id);
    if (error) revertProviderSelection(previous, error);
  }

  function setSelectedModel(modelId: string) {
    deps.preferences.setSelectedModelFor(effectiveProvider, modelId);
  }

  return {
    state,
    get activeCredential(): Credential | null {
      return activeCredential;
    },
    get effectiveProvider(): AnyProvider {
      return effectiveProvider;
    },
    get effectiveModelId(): string {
      return effectiveModelId;
    },
    get canTranslate(): boolean {
      return canTranslate;
    },
    changeProvider,
    setSelectedModel,
  };
}
