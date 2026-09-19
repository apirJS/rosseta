import { sendMessageToRuntime } from '../../../../../../shared/messaging';
import type { AnyProvider } from '../../../../../../core/domain/credential/Provider';

export type TranslationView =
  | 'main'
  | 'manage-api-keys'
  | 'manage-models'
  | 'custom-providers'
  | 'settings'
  | 'history';

export type MenuDestination = Exclude<TranslationView, 'main'>;

export type PopupNavigation = ReturnType<typeof createHomeController>;

class TranslationControllerState {
  currentView = $state<TranslationView>('main');
  slideDirection = $state<'forward' | 'back'>('forward');
  isMenuOpen = $state(false);
  selectedProvider = $state<AnyProvider | null>(null);
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

  function showManageModels() {
    state.slideDirection = 'forward';
    state.currentView = 'manage-models';
    state.isMenuOpen = false;
  }

  function showCustomProviders() {
    state.slideDirection = 'forward';
    state.currentView = 'custom-providers';
    state.isMenuOpen = false;
  }

  function showSettings() {
    state.slideDirection = 'forward';
    state.currentView = 'settings';
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
    window.close();
  }

  function showHistory() {
    state.slideDirection = 'forward';
    state.currentView = 'history';
    state.isMenuOpen = false;
  }

  function navigateTo(view: TranslationView, provider?: AnyProvider) {
    if (provider) state.selectedProvider = provider;
    if (view === 'main') {
      showMain();
      return;
    }
    state.slideDirection = 'forward';
    state.currentView = view;
    state.isMenuOpen = false;
  }

  return {
    state,
    showMain,
    showManageApiKeys,
    showManageModels,
    showCustomProviders,
    showSettings,
    showHistory,
    navigateTo,
    toggleMenu,
    closeMenu,
    startTranslation,
  };
}
