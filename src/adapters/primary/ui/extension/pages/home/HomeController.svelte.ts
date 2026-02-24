import { sendMessageToRuntime } from '../../../../../../shared/messaging';

export type TranslationView =
  | 'main'
  | 'manage-api-keys'
  | 'history'
  | 'proxy-settings';

class TranslationControllerState {
  currentView = $state<TranslationView>('main');
  slideDirection = $state<'forward' | 'back'>('forward');
  isMenuOpen = $state(false);
}

export function createHomeController() {
  const state = new TranslationControllerState();

  function showMain() {
    state.slideDirection = 'back';
    state.currentView = 'main';
  }

  function showManageApiKeys() {
    state.slideDirection = 'forward';
    state.currentView = 'manage-api-keys';
    state.isMenuOpen = false;
  }

  function toggleMenu() {
    state.isMenuOpen = !state.isMenuOpen;
  }

  function closeMenu() {
    state.isMenuOpen = false;
  }

  async function startTranslation() {
    await sendMessageToRuntime({ action: 'START_OVERLAY' });
    window.close(); // Close popup after triggering
  }

  function showHistory() {
    state.slideDirection = 'forward';
    state.currentView = 'history';
    state.isMenuOpen = false;
  }

  function showProxySettings() {
    state.slideDirection = 'forward';
    state.currentView = 'proxy-settings';
    state.isMenuOpen = false;
  }

  return {
    state,
    showMain,
    showManageApiKeys,
    showHistory,
    showProxySettings,
    toggleMenu,
    closeMenu,
    startTranslation,
  };
}
