<script lang="ts">
  import browser from 'webextension-polyfill';
  import { sendMessageToRuntime } from '../../../../../../shared/messaging';
  import {
    openShortcutSettings,
    shortcutSettingsUrl,
  } from '../../browser/shortcut-settings';
  import {
    getAuthStateContext,
    getCustomProvidersStateContext,
    getModelsStateContext,
    getPopupToastContext,
    getPreferencesStateContext,
  } from '../../context';
  import { Checkbox } from '../../../shared/components';
  import type { LanguageCode } from '../../../shared/constants/languages';
  import { createHomeController } from './HomeController.svelte';
  import { createKeySelectionController } from './KeySelectionController.svelte';
  import type { PopupNavigation } from '../../PopupNavigationController.svelte';
  import HomeHeader from './components/HomeHeader.svelte';
  import KeySelector from './components/KeySelector.svelte';
  import ModelSelector from './components/ModelSelector.svelte';
  import LanguageSelector from './components/LanguageSelector.svelte';
  import TranslateButton from './components/TranslateButton.svelte';

  interface Props {
    navigation: PopupNavigation;
  }

  const { navigation }: Props = $props();

  const auth = getAuthStateContext();
  const preferences = getPreferencesStateContext();
  const models = getModelsStateContext();
  const customProviders = getCustomProvidersStateContext();
  const toast = getPopupToastContext();
  const version = browser.runtime.getManifest().version;

  // svelte-ignore state_referenced_locally
  const controller = createHomeController({
    auth,
    preferences,
    models,
    customProviders,
    toast,
    providerSelection: navigation.state,
    startCapture: () => sendMessageToRuntime({ action: 'START_OVERLAY' }),
    closePopup: () => window.close(),
    openShortcutSettings,
    shortcutSettingsUrl: shortcutSettingsUrl(),
  });

  const keySelection = createKeySelectionController({
    getProvider: () => controller.effectiveProvider,
    getCredential: () => controller.activeCredential,
    auth,
    toast,
  });
</script>

<div class="flex flex-col h-full w-full bg-background">
  <HomeHeader
    isMenuOpen={navigation.state.isMenuOpen}
    onToggleMenu={navigation.toggleMenu}
    onCloseMenu={navigation.closeMenu}
    selectedProvider={controller.effectiveProvider}
    providerOptions={customProviders.options}
    changingProvider={controller.changingProvider}
    {version}
    onProviderChange={controller.changeProvider}
    isDark={preferences.state.resolvedTheme === 'dark'}
    onToggleTheme={preferences.toggleTheme}
    onNavigate={(destination) =>
      navigation.navigateTo(destination, controller.effectiveProvider)}
  />

  {#if preferences.state.loaded}
    <div class="flex-1 flex flex-col justify-center px-4 pb-4 space-y-4">
      <KeySelector
        credentials={keySelection.providerCredentials}
        activeCredentialId={keySelection.providerActive?.id ?? null}
        currentMode={keySelection.currentMode}
        autoBalanceProviders={keySelection.autoBalanceProviders}
        isOpen={keySelection.state.isOpen}
        label={keySelection.getTriggerLabel()}
        disabled={controller.changingProvider}
        onToggle={keySelection.toggle}
        onClose={keySelection.close}
        onSelectKey={keySelection.selectKey}
        onSelectAutoBalance={keySelection.selectAutoBalance}
      />

      <ModelSelector
        value={controller.effectiveModelId}
        options={controller.modelOptions}
        onchange={controller.setSelectedModel}
      />

      <LanguageSelector
        value={preferences.state.targetLanguage.code as LanguageCode}
        onchange={preferences.setTargetLanguage}
      />

      <Checkbox
        label="Enable Description"
        checked={preferences.state.includeDescription}
        onChange={(e) =>
          preferences.setIncludeDescription(e.currentTarget.checked)}
      />

      <div class="pt-2">
        <TranslateButton
          onclick={controller.startTranslation}
          disabled={!controller.canTranslate}
          shortcutLabel={preferences.state.shortcut}
          shortcutSettingsUrl={controller.shortcutSettingsUrl}
          onOpenShortcutSettings={controller.openShortcutSettings}
        />
      </div>
    </div>
  {/if}
</div>
