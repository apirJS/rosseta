import { sendMessageToRuntime } from '../../../../../../shared/messaging';
import type { AnyProvider } from '../../../../../../core/domain/credential/Provider';
import {
  openShortcutSettings as openBrowserShortcutSettings,
  shortcutSettingsUrl,
} from '../../../shared/browser/shortcut-settings';
import type { PopupToastController } from '../../../shared/toast/PopupToastController.svelte';

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

async function startTranslation(): Promise<void> {
  await sendMessageToRuntime({ action: 'START_OVERLAY' });
  window.close();
}

export function createHomeController(deps?: {
  toast: Pick<PopupToastController, 'show'>;
}) {
  const state = new TranslationControllerState();

  async function openShortcutSettings() {
    try {
      await openBrowserShortcutSettings();
    } catch {
      deps?.toast.show({
        type: 'error',
        message: 'Could not open shortcut settings',
        description: `Open ${shortcutSettingsUrl()} to configure the translation shortcut.`,
      });
    }
  }

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
    openShortcutSettings,
    shortcutSettingsUrl: shortcutSettingsUrl(),
  };
}
