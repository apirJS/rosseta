import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createHomeController } from './HomeController.svelte';

vi.mock('../../../../../../shared/messaging', () => ({
  sendMessageToRuntime: vi.fn().mockResolvedValue(undefined),
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
});
