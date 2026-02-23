import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createHomeController } from './HomeController.svelte';

vi.mock('../../../../../../shared/messaging', () => ({
  sendMessageToRuntime: vi.fn().mockResolvedValue(undefined),
}));

// Import after mock so we get the mocked version
import { sendMessageToRuntime } from '../../../../../../shared/messaging';

describe('UI Controller: HomeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial State ──────────────────────────────────────────────

  test('initial state is "main" view with menu closed', () => {
    const controller = createHomeController();

    expect(controller.state.currentView).toBe('main');
    expect(controller.state.isMenuOpen).toBe(false);
  });

  // ── View Transitions ──────────────────────────────────────────

  test('showManageApiKeys switches to "manage-api-keys" and closes menu', () => {
    const controller = createHomeController();
    controller.toggleMenu(); // open menu first
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

  test('showProxySettings switches to "proxy-settings" and closes menu', () => {
    const controller = createHomeController();
    controller.toggleMenu();

    controller.showProxySettings();

    expect(controller.state.currentView).toBe('proxy-settings');
    expect(controller.state.isMenuOpen).toBe(false);
  });

  test('showMain resets to "main" from "proxy-settings"', () => {
    const controller = createHomeController();
    controller.showProxySettings();

    controller.showMain();

    expect(controller.state.currentView).toBe('main');
    expect(controller.state.isMenuOpen).toBe(false);
  });

  test('showMain resets to "main" and closes menu', () => {
    const controller = createHomeController();
    controller.showHistory();
    controller.toggleMenu();

    controller.showMain();

    expect(controller.state.currentView).toBe('main');
    expect(controller.state.isMenuOpen).toBe(false);
  });

  // ── Menu Logic ─────────────────────────────────────────────────

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

  // ── Start Translation ──────────────────────────────────────────

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
