import type { AnyProvider } from '../../../../core/domain/credential/Provider';

export type PopupView =
  | 'home'
  | 'manage-api-keys'
  | 'manage-models'
  | 'custom-providers'
  | 'settings'
  | 'history';

export type MenuDestination = Exclude<PopupView, 'home'>;
export type PopupNavigation = ReturnType<
  typeof createPopupNavigationController
>;

export class PopupNavigationState {
  currentView = $state<PopupView>('home');
  slideDirection = $state<'forward' | 'back'>('forward');
  isMenuOpen = $state(false);
  // Lives with the router so selection survives leaving and reopening Home.
  selectedProvider = $state<AnyProvider | null>(null);
}

export function createPopupNavigationController() {
  const state = new PopupNavigationState();

  function navigateTo(view: PopupView, provider?: AnyProvider) {
    if (provider) state.selectedProvider = provider;
    state.slideDirection = view === 'home' ? 'back' : 'forward';
    state.currentView = view;
    state.isMenuOpen = false;
  }

  return {
    state,
    navigateTo,
    showHome: () => navigateTo('home'),
    toggleMenu: () => {
      state.isMenuOpen = !state.isMenuOpen;
    },
    closeMenu: () => {
      state.isMenuOpen = false;
    },
  };
}
