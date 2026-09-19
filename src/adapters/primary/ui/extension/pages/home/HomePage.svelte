<script lang="ts">
  import {
    getAuthStateContext,
    getCustomProvidersStateContext,
    getModelsStateContext,
    getPopupToastContext,
    getPreferencesStateContext,
  } from '../../../shared/context';
  import { Checkbox } from '../../../shared/components';
  import type { LanguageCode } from '../../../shared/constants/languages';
  import { createMainPageController } from './MainPageController.svelte';
  import type { PopupNavigation } from './HomeController.svelte';
  import MainHeader from './components/MainHeader.svelte';
  import ActiveKeyIndicator from './components/ActiveKeyIndicator.svelte';
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

  // svelte-ignore state_referenced_locally
  const controller = createMainPageController({
    auth,
    preferences,
    models,
    customProviders,
    toast,
    providerSelection: navigation.state,
  });
</script>

<div class="flex flex-col h-full w-full bg-background">
  <MainHeader
    isMenuOpen={navigation.state.isMenuOpen}
    onToggleMenu={navigation.toggleMenu}
    onCloseMenu={navigation.closeMenu}
    selectedProvider={controller.effectiveProvider}
    onProviderChange={controller.changeProvider}
    isDark={preferences.state.resolvedTheme === 'dark'}
    onToggleTheme={preferences.toggleTheme}
    onNavigate={(destination) =>
      navigation.navigateTo(destination, controller.effectiveProvider)}
  />

  {#if preferences.state.loaded}
    <div class="flex-1 flex flex-col justify-center px-4 pb-4 space-y-4">
      <ActiveKeyIndicator
        provider={controller.effectiveProvider}
        credential={controller.activeCredential}
      />

      <ModelSelector
        value={controller.effectiveModelId}
        provider={controller.effectiveProvider}
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
          onclick={navigation.startTranslation}
          disabled={!controller.canTranslate}
        />
      </div>
    </div>
  {/if}
</div>
