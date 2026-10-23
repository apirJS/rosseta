import { describe, expect, test } from 'vitest';
import {
  createPopupNavigationController,
  type MenuDestination,
} from './PopupNavigationController.svelte';

describe('UI Controller: popup navigation', () => {
  test('opens on Home with the menu closed', () => {
    const navigation = createPopupNavigationController();

    expect(navigation.state.currentView).toBe('home');
    expect(navigation.state.isMenuOpen).toBe(false);
  });

  test.each<MenuDestination>([
    'manage-api-keys',
    'manage-models',
    'custom-providers',
    'settings',
    'history',
  ])(
    'navigates to %s, closes the menu, and preserves the provider on return',
    (destination) => {
      const navigation = createPopupNavigationController();

      navigation.toggleMenu();
      navigation.navigateTo(destination, 'groq');
      expect(navigation.state.currentView).toBe(destination);
      expect(navigation.state.slideDirection).toBe('forward');
      expect(navigation.state.isMenuOpen).toBe(false);
      expect(navigation.state.selectedProvider).toBe('groq');
      navigation.showHome();
      expect(navigation.state.currentView).toBe('home');
      expect(navigation.state.slideDirection).toBe('back');
      expect(navigation.state.selectedProvider).toBe('groq');
    },
  );

  test('toggles and closes the menu without changing the route', () => {
    const navigation = createPopupNavigationController();

    navigation.toggleMenu();
    expect(navigation.state.isMenuOpen).toBe(true);
    navigation.toggleMenu();
    expect(navigation.state.isMenuOpen).toBe(false);
    navigation.toggleMenu();
    navigation.closeMenu();
    navigation.closeMenu();
    expect(navigation.state.isMenuOpen).toBe(false);
    expect(navigation.state.currentView).toBe('home');
  });
});
