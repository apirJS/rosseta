import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createHomeController } from './HomeController.svelte';
import { openShortcutSettings } from '../../../shared/browser/shortcut-settings';

vi.mock('../../../../../../shared/messaging', () => ({
  sendMessageToRuntime: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../shared/browser/shortcut-settings', () => ({
  openShortcutSettings: vi.fn().mockResolvedValue(undefined),
  shortcutSettingsUrl: () => 'chrome://extensions/shortcuts',
}));

import { sendMessageToRuntime } from '../../../../../../shared/messaging';

describe('UI Controller: HomeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('initial state is "main" view with menu closed', () => {
    const controller = createHomeController();

    expect(controller.state.currentView).toBe('main');
    expect(controller.state.isMenuOpen).toBe(false);
  });

  test('showManageApiKeys switches to "manage-api-keys" and closes menu', () => {
    const controller = createHomeController();
    controller.toggleMenu();
    expect(controller.state.isMenuOpen).toBe(true);

    controller.showManageApiKeys();

    expect(controller.state.currentView).toBe('manage-api-keys');
    expect(controller.state.isMenuOpen).toBe(false);
  });

  test('showHistory switches to "history" and closes menu', () => {
    const controller = createHomeController();
    controller.toggleMenu();

    controller.showHistory();

    expect(controller.state.currentView).toBe('history');
    expect(controller.state.isMenuOpen).toBe(false);
  });

  test('showManageModels switches to "manage-models" and closes menu', () => {
    const controller = createHomeController();
    controller.toggleMenu();

    controller.showManageModels();

    expect(controller.state.currentView).toBe('manage-models');
    expect(controller.state.isMenuOpen).toBe(false);
  });

  test('showMain resets to "main" with back direction', () => {
    const controller = createHomeController();
    controller.showHistory();

    controller.showMain();

    expect(controller.state.currentView).toBe('main');
    expect(controller.state.slideDirection).toBe('back');
  });

  test('toggleMenu flips isMenuOpen', () => {
    const controller = createHomeController();

    controller.toggleMenu();
    expect(controller.state.isMenuOpen).toBe(true);

    controller.toggleMenu();
    expect(controller.state.isMenuOpen).toBe(false);
  });

  test('closeMenu sets isMenuOpen to false', () => {
    const controller = createHomeController();
    controller.toggleMenu();
    expect(controller.state.isMenuOpen).toBe(true);

    controller.closeMenu();
    expect(controller.state.isMenuOpen).toBe(false);
  });

  test('closeMenu is idempotent when already closed', () => {
    const controller = createHomeController();
    expect(controller.state.isMenuOpen).toBe(false);

    controller.closeMenu();
    expect(controller.state.isMenuOpen).toBe(false);
  });

  test('startTranslation sends START_OVERLAY message and closes window', async () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    const controller = createHomeController();

    await controller.startTranslation();

    expect(sendMessageToRuntime).toHaveBeenCalledWith({
      action: 'START_OVERLAY',
    });
    expect(closeSpy).toHaveBeenCalled();

    closeSpy.mockRestore();
  });

  test('opens shortcut settings independently of translation', async () => {
    const controller = createHomeController();
    await controller.openShortcutSettings();
    expect(openShortcutSettings).toHaveBeenCalledOnce();
    expect(controller.shortcutSettingsUrl).toBe('chrome://extensions/shortcuts');
    expect(sendMessageToRuntime).not.toHaveBeenCalled();
  });

  test('reports navigation failure with a manual settings destination', async () => {
    vi.mocked(openShortcutSettings).mockRejectedValueOnce(new Error('Navigation blocked'));
    const toast = { show: vi.fn() };
    await createHomeController({ toast }).openShortcutSettings();
    expect(toast.show).toHaveBeenCalledWith({
      type: 'error', message: 'Could not open shortcut settings',
      description: 'Open chrome://extensions/shortcuts to configure the translation shortcut.',
    });
  });

  test('navigateTo switches to any view and closes the menu', () => {
    const controller = createHomeController();
    controller.toggleMenu();

    controller.navigateTo('manage-models');

    expect(controller.state.currentView).toBe('manage-models');
    expect(controller.state.slideDirection).toBe('forward');
    expect(controller.state.isMenuOpen).toBe(false);
  });

  test('navigateTo returns to main with back direction', () => {
    const controller = createHomeController();
    controller.navigateTo('history');

    controller.navigateTo('main');

    expect(controller.state.currentView).toBe('main');
    expect(controller.state.slideDirection).toBe('back');
  });
});
