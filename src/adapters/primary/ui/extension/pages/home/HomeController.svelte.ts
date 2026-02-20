import { sendMessageToRuntime } from '../../../../../../shared/messaging';

export type TranslationView = 'main' | 'manage-api-keys' | 'history';

class TranslationControllerState {
  currentView = $state<TranslationView>('main');
  isMenuOpen = $state(false);
}

export function createHomeController() {
  const state = new TranslationControllerState();

  function showMain() {
    state.currentView = 'main';
    state.isMenuOpen = false;
  }

  function showManageApiKeys() {
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
    state.currentView = 'history';
    state.isMenuOpen = false;
  }

  return {
    state,
    showMain,
    showManageApiKeys,
    showHistory,
    toggleMenu,
    closeMenu,
    startTranslation,
  };
}
