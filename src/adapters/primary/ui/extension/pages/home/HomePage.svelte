<script lang="ts">
  import {
    getAuthStateContext,
    getCustomProvidersStateContext,
    getModelsStateContext,
    getPopupToastContext,
    getPreferencesStateContext,
  } from '../../../shared/context';
  import { Icon, ThemeToggle } from '../../../shared/components';
  import {
    DEFAULT_PROVIDER,
    isProvider,
    isAnyProvider,
    type AnyProvider,
  } from '../../../../../../core/domain/credential/Provider';
  import { KeySelectionMode } from '../../../../../../core/domain/credential/KeySelectionMode';
  import { isCustomProviderId } from '../../../../../../core/domain/provider/CustomProviderConfig';
  import { ProviderRegistry } from '../../../../../../core/domain/provider/ProviderRegistry';
  import { createHomeController } from './HomeController.svelte';
  import ActiveKeyIndicator from './components/ActiveKeyIndicator.svelte';
  import AppMenu from './components/AppMenu.svelte';
  import ProviderSelector from './components/ProviderSelector.svelte';
  import ModelSelector from './components/ModelSelector.svelte';
  import LanguageSelector from './components/LanguageSelector.svelte';
  import TranslateButton from './components/TranslateButton.svelte';
  import HistoryPage from '../history/HistoryPage.svelte';
  import ManageKeysPage from '../manage-keys/ManageKeysPage.svelte';
  import ManageModelsPage from '../manage-models/ManageModelsPage.svelte';
  import CustomProvidersPage from '../custom-providers/CustomProvidersPage.svelte';
  import type { LanguageCode } from '../../../shared/constants/languages';

  const auth = getAuthStateContext();
  const preferences = getPreferencesStateContext();
  const models = getModelsStateContext();
  const customProviders = getCustomProvidersStateContext();
  const toast = getPopupToastContext();
  const controller = createHomeController();

  const activeCredential = $derived(
    auth.state.credentials?.getActive() ?? null,
  );
  const activeProvider = $derived.by(() => {
    const mode = auth.state.keySelectionMode;
    if (mode.isAutoBalance) {
      return mode.autoBalanceProvider ?? DEFAULT_PROVIDER;
    }
    return activeCredential?.provider ?? DEFAULT_PROVIDER;
  });

  let selectedProvider = $state<AnyProvider | null>(null);
  const effectiveProvider = $derived(selectedProvider ?? activeProvider);

  const providerKeys = $derived(
    auth.state.credentials?.getByProvider(effectiveProvider) ?? [],
  );
  const providerModels = $derived(models.modelsFor(effectiveProvider));

  const effectiveModelId = $derived.by(() => {
    const saved = preferences.state.selectedModels[effectiveProvider];
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
      preferences.state.selectedModels[effectiveProvider] !== effectiveModelId
    ) {
      void preferences.setSelectedModelFor(effectiveProvider, effectiveModelId);
    }
  });

  $effect(() => {
    const credentials = auth.state.credentials;
    if (!credentials) return;

    const keys = credentials.getByProvider(effectiveProvider);
    if (keys.length === 0) return;

    const mode = auth.state.keySelectionMode;
    if (mode.isAutoBalance && mode.autoBalanceProvider === effectiveProvider) {
      return;
    }

    const active = credentials.getActive();
    if (active && active.provider === effectiveProvider) return;

    void auth.setActiveKey(keys[0].id);
  });

  $effect(() => {
    if (
      selectedProvider !== null &&
      isCustomProviderId(selectedProvider) &&
      !customProviders.getProvider(selectedProvider)
    ) {
      selectedProvider = null;
    }
  });

  async function handleProviderChange(newValue: string) {
    if (!isAnyProvider(newValue) || newValue === effectiveProvider) return;

    const previous = effectiveProvider;
    selectedProvider = newValue;

    const candidates = auth.state.credentials?.getByProvider(newValue) ?? [];
    if (candidates.length === 0) return;

    if (!auth.state.keySelectionMode.isManual) {
      const modeError = await auth.setKeySelectionMode(
        KeySelectionMode.manual(),
      );
      if (modeError) {
        revertProviderSelection(previous, modeError);
        return;
      }
    }

    const error = await auth.setActiveKey(candidates[0].id);
    if (error) revertProviderSelection(previous, error);
  }

  function revertProviderSelection(previous: AnyProvider, error: string) {
    selectedProvider = previous === activeProvider ? null : previous;
    toast.show({
      type: 'error',
      message: 'Could not switch provider',
      description: error,
    });
  }

  function handleManageKeys() {
    controller.closeMenu();
    controller.showManageApiKeys();
  }

  function handleManageModels() {
    controller.closeMenu();
    controller.showManageModels();
  }

  function handleCustomProviders() {
    controller.closeMenu();
    controller.showCustomProviders();
  }

  let menuAreaEl = $state<HTMLDivElement>();

  $effect(() => {
    if (!controller.state.isMenuOpen) return;

    function handleClickOutside(e: PointerEvent) {
      if (menuAreaEl && !menuAreaEl.contains(e.target as Node)) {
        controller.closeMenu();
      }
    }

    document.addEventListener('pointerdown', handleClickOutside);
    return () =>
      document.removeEventListener('pointerdown', handleClickOutside);
  });
</script>

<div
  class="view-container"
  class:slide-forward={controller.state.slideDirection === 'forward'}
  class:slide-back={controller.state.slideDirection === 'back'}
>
  {#key controller.state.currentView}
    {#if controller.state.currentView === 'manage-api-keys'}
      <ManageKeysPage onback={controller.showMain} />
    {:else if controller.state.currentView === 'manage-models'}
      <ManageModelsPage onback={controller.showMain} />
    {:else if controller.state.currentView === 'custom-providers'}
      <CustomProvidersPage onback={controller.showMain} />
    {:else if controller.state.currentView === 'history'}
      <HistoryPage onback={controller.showMain} />
    {:else}
      <div class="flex flex-col h-full w-full bg-background">
        <div class="flex justify-between items-center p-4 pb-0">
          <div class="flex items-center gap-2 min-w-0">
            <div class="relative" bind:this={menuAreaEl}>
              <button
                type="button"
                class="p-1 text-muted hover:text-foreground cursor-pointer"
                onclick={controller.toggleMenu}
                aria-label="Menu"
              >
                <Icon name="menu" class="w-5 h-5" />
              </button>
              {#if controller.state.isMenuOpen}
                <AppMenu
                  onManageKeys={handleManageKeys}
                  onManageModels={handleManageModels}
                  onCustomProviders={handleCustomProviders}
                  onHistory={controller.showHistory}
                />
              {/if}
            </div>
            <div class="w-36 shrink-0">
              <ProviderSelector
                value={effectiveProvider}
                compact
                onchange={handleProviderChange}
              />
            </div>
          </div>
          <ThemeToggle
            isDark={preferences.state.resolvedTheme === 'dark'}
            onToggle={preferences.toggleTheme}
          />
        </div>

        {#if preferences.state.loaded}
          <div class="flex-1 flex flex-col justify-center px-4 pb-4 space-y-4">
            <ActiveKeyIndicator
              provider={effectiveProvider}
              credential={activeCredential}
            />

            <ModelSelector
              value={effectiveModelId}
              provider={effectiveProvider}
              onchange={(id) =>
                preferences.setSelectedModelFor(effectiveProvider, id)}
            />

            <LanguageSelector
              value={preferences.state.targetLanguage.code as LanguageCode}
              onchange={preferences.setTargetLanguage}
            />

            <div class="pt-2">
              <TranslateButton
                onclick={controller.startTranslation}
                disabled={!canTranslate}
              />
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/key}
</div>

<style>
  .view-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  .view-container.slide-forward > :global(:first-child) {
    animation: slide-in-left 0.2s ease-out;
  }

  .view-container.slide-back > :global(:first-child) {
    animation: slide-in-right 0.2s ease-out;
  }

  @keyframes slide-in-left {
    from {
      transform: translateX(30%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slide-in-right {
    from {
      transform: translateX(-30%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
