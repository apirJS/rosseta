<script lang="ts">
  import {
    getAuthStateContext,
    getPreferencesStateContext,
    getTranslationContext,
  } from '../../../shared/context';
  import { ThemeToggle } from '../../../shared/components';
  import { createHomeController } from './HomeController.svelte';
  import ActiveKeyIndicator from './components/ActiveKeyIndicator.svelte';
  import AppMenu from './components/AppMenu.svelte';
  import ModelSelector from './components/ModelSelector.svelte';
  import LanguageSelector from './components/LanguageSelector.svelte';
  import TranslateButton from './components/TranslateButton.svelte';
  import LogoutConfirmModal from './components/LogoutConfirmModal.svelte';
  import HistoryPage from '../history/HistoryPage.svelte';
  import ManageKeysPage from '../manage-keys/ManageKeysPage.svelte';
  import ProxySettingsPage from '../proxy-settings/ProxySettingsPage.svelte';
  import type { LanguageCode } from '../../../shared/constants/languages';

  const auth = getAuthStateContext();
  const preferences = getPreferencesStateContext();
  const translation = getTranslationContext();
  const controller = createHomeController();

  const activeCredential = $derived(
    auth.state.credentials?.getActive() ?? null,
  );
  const activeProvider = $derived.by(() => {
    const mode = auth.state.keySelectionMode;
    if (mode.isAutoBalance) {
      return mode.autoBalanceProvider!;
    }
    return activeCredential?.provider ?? 'gemini';
  });

  let showLogoutModal = $state(false);

  function handleLogoutClick() {
    controller.closeMenu();
    showLogoutModal = true;
  }

  async function handleLogoutConfirm(deleteHistory: boolean) {
    showLogoutModal = false;
    if (deleteHistory) {
      await translation.clearAllTranslations.execute();
    }
    auth.logout();
  }

  function handleLogoutCancel() {
    showLogoutModal = false;
  }

  function handleManageKeys() {
    controller.closeMenu();
    controller.showManageApiKeys();
  }

  function handleProxySettings() {
    controller.closeMenu();
    controller.showProxySettings();
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

{#if controller.state.currentView === 'manage-api-keys'}
  <ManageKeysPage onback={controller.showMain} />
{:else if controller.state.currentView === 'history'}
  <HistoryPage onback={controller.showMain} />
{:else if controller.state.currentView === 'proxy-settings'}
  <ProxySettingsPage onback={controller.showMain} />
{:else if controller.state.currentView === 'main' && activeCredential}
  <div class="flex flex-col h-full w-full bg-background">
    <div class="flex justify-between items-center p-4 pb-0">
      <div class="relative" bind:this={menuAreaEl}>
        <ActiveKeyIndicator
          credential={activeCredential}
          onMenuToggle={controller.toggleMenu}
          isMenuOpen={controller.state.isMenuOpen}
        />
        {#if controller.state.isMenuOpen}
          <AppMenu
            onLogout={handleLogoutClick}
            onManageKeys={handleManageKeys}
            onProxySettings={handleProxySettings}
            onHistory={controller.showHistory}
          />
        {/if}
      </div>
      <ThemeToggle
        isDark={preferences.state.resolvedTheme === 'dark'}
        onToggle={preferences.toggleTheme}
      />
    </div>

    {#if preferences.state.loaded}
      <div class="flex-1 flex flex-col justify-center px-4 pb-4 space-y-4">
        <ModelSelector
          value={preferences.state.selectedModel.id}
          provider={activeProvider}
          onchange={preferences.setSelectedModel}
        />

        <LanguageSelector
          value={preferences.state.targetLanguage.code as LanguageCode}
          provider={activeProvider}
          onchange={preferences.setTargetLanguage}
        />

        <div class="pt-2">
          <TranslateButton onclick={controller.startTranslation} />
        </div>
      </div>
    {/if}
  </div>

  {#if showLogoutModal}
    <LogoutConfirmModal
      onconfirm={handleLogoutConfirm}
      oncancel={handleLogoutCancel}
    />
  {/if}
{/if}
