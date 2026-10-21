import {
  DEFAULT_PROVIDER,
  isAnyProvider,
  type AnyProvider,
} from '../../../../../../core/domain/credential/Provider';
import { KeySelectionMode } from '../../../../../../core/domain/credential/KeySelectionMode';
import type { Credential } from '../../../../../../core/domain/credential/Credential';
import type { Credentials } from '../../../../../../core/domain/credential/Credentials';
import { isCustomProviderId } from '../../../../../../core/domain/provider/CustomProviderConfig';
import { getProviderDefaultModelId } from '../../../../../../core/domain/provider/provider-definitions';
import { resolveModelId } from '../../../../../../core/domain/preferences/model-selection';
import type { StoredModel } from '../../../../../../core/ports/outbound/IModelStorage';
import type { PopupToastController } from '../../toast/PopupToastController.svelte';

export interface HomeDeps {
  auth: {
    state: {
      credentials: Credentials | null;
      keySelectionMode: KeySelectionMode;
    };
    setActiveKey: (credentialId: string) => Promise<string | null>;
    setKeySelectionMode: (mode: KeySelectionMode) => Promise<string | null>;
  };
  preferences: {
    state: { selectedModels: Record<string, string> };
    setSelectedModelFor: (provider: string, modelId: string) => void;
  };
  models: { modelsFor: (provider: string) => StoredModel[] };
  customProviders: {
    state: { hydrated: boolean };
    getProvider: (id: string) => { id: string } | null;
  };
  toast: Pick<PopupToastController, 'show'>;
  providerSelection: {
    selectedProvider: AnyProvider | null;
  };
  startCapture: () => Promise<void>;
  closePopup: () => void;
  openShortcutSettings: () => Promise<void>;
  shortcutSettingsUrl: string;
}

export function createHomeController(deps: HomeDeps) {
  const providerSelection = deps.providerSelection;
  let changingProvider = $state(false);

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

  function isMissingCustomProvider(provider: AnyProvider): boolean {
    return (
      deps.customProviders.state.hydrated &&
      isCustomProviderId(provider) &&
      !deps.customProviders.getProvider(provider)
    );
  }

  const selectedOrActiveProvider = $derived(
    providerSelection.selectedProvider ?? activeProvider,
  );

  const effectiveProvider = $derived(
    isMissingCustomProvider(selectedOrActiveProvider)
      ? 'deepseek'
      : selectedOrActiveProvider,
  );

  const providerKeys = $derived(
    deps.auth.state.credentials?.getByProvider(effectiveProvider) ?? [],
  );

  const providerModels = $derived(deps.models.modelsFor(effectiveProvider));

  const modelOptions = $derived(
    providerModels.map((model) => ({
      value: model.id,
      label: model.name !== model.id ? `${model.name} (${model.id})` : model.id,
    })),
  );

  const effectiveModelId = $derived.by(() => {
    // The popup requires a catalog entry before enabling translation. A
    // background request may still use a saved/default ID without a catalog.
    if (providerModels.length === 0) return '';

    return resolveModelId({
      savedModelId: deps.preferences.state.selectedModels[effectiveProvider],
      defaultModelId: getProviderDefaultModelId(effectiveProvider),
      availableModels: providerModels,
    });
  });

  const canTranslate = $derived(
    !changingProvider && providerKeys.length > 0 && effectiveModelId !== '',
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
    if (changingProvider) return;

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
    if (isMissingCustomProvider(selectedOrActiveProvider)) {
      providerSelection.selectedProvider = 'deepseek';
    }
  });

  function revertProviderSelection(previous: AnyProvider, error: string) {
    providerSelection.selectedProvider =
      previous === activeProvider ? null : previous;

    deps.toast.show({
      type: 'error',
      message: 'Could not switch provider',
      description: error,
    });
  }

  async function changeProvider(newValue: string): Promise<void> {
    if (
      changingProvider ||
      !isAnyProvider(newValue) ||
      newValue === effectiveProvider
    )
      return;

    const previous = effectiveProvider;

    changingProvider = true;
    providerSelection.selectedProvider = newValue;

    try {
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
    } catch {
      revertProviderSelection(previous, 'Please try again.');
    } finally {
      changingProvider = false;
    }
  }

  function setSelectedModel(modelId: string) {
    deps.preferences.setSelectedModelFor(effectiveProvider, modelId);
  }

  async function startTranslation(): Promise<void> {
    try {
      await deps.startCapture();
      deps.closePopup();
    } catch {
      deps.toast.show({
        type: 'error',
        message: 'Could not start translation',
        description: 'Try again on the page you want to translate.',
      });
    }
  }

  async function openShortcutSettings(): Promise<void> {
    try {
      await deps.openShortcutSettings();
    } catch {
      deps.toast.show({
        type: 'error',
        message: 'Could not open shortcut settings',
        description: `Open ${deps.shortcutSettingsUrl} to configure the translation shortcut.`,
      });
    }
  }

  return {
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
    get modelOptions() {
      return modelOptions;
    },
    get changingProvider() {
      return changingProvider;
    },
    changeProvider,
    setSelectedModel,
    startTranslation,
    openShortcutSettings,
    shortcutSettingsUrl: deps.shortcutSettingsUrl,
  };
}
