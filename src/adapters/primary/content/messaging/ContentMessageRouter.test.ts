import { describe, expect, test, mock, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { resetBrowserMock } from '../../../../../tests/browser-mock';

// ── Mock Svelte-dependent handler modules ────────────────────────────
// ToastController.svelte and svelte itself are mocked in the preload
// (browser-mock.ts). We only need to mock the handler classes here.

const mockOverlayHandle = mock();
const mockTranslationModalHandle = mock();
const mockToastShow = mock();
const mockToastDismiss = mock();

// ── Provide window.matchMedia for ThemeManager ───────────────────────
globalThis.window =
  globalThis.window || ({} as unknown as typeof globalThis.window);

(globalThis.window as unknown as Record<string, unknown>).matchMedia = ((
  query: string,
) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  onchange: null,
  dispatchEvent: () => false,
})) as typeof globalThis.window.matchMedia;

// ── Import AFTER all mocks ──────────────────────────────────────────

import { ContentMessageRouter } from './ContentMessageRouter';
import { ThemeManager } from '../hosts/ThemeManager';

const runtimeOnMessage = browser.runtime as unknown as {
  onMessage: { addListener: ReturnType<typeof mock> };
};

describe('Adapter: ContentMessageRouter', () => {
  let callback: (message: unknown) => Promise<unknown>;

  beforeEach(() => {
    resetBrowserMock();
    mockOverlayHandle.mockClear();
    mockTranslationModalHandle.mockClear();
    mockToastShow.mockClear();
    mockToastDismiss.mockClear();

    const themeManager = new ThemeManager();

    const router = new ContentMessageRouter(themeManager, {
      translation: {
        handle: mockTranslationModalHandle,
        register: mock((requestId) => ({
          requestId,
          documentSessionId: 'session',
        })),
        runtimeSettled: mock(),
        runtimeFailed: mock(),
        dispose: mock(),
        resetDocument: mock(),
        checkDeadlines: mock(),
        receive: mock(),
      },
      toast: { show: mockToastShow, dismiss: mockToastDismiss },
      createOverlay: () => ({ handle: mockOverlayHandle }),
    });

    router.register();

    callback = runtimeOnMessage.onMessage.addListener.mock
      .calls[0][0] as typeof callback;
  });

  test('MOUNT_OVERLAY → calls overlayHandler.handle(rawImage)', async () => {
    await callback({
      action: 'MOUNT_OVERLAY',
      payload: { rawImage: 'data:image/png;base64,abc' },
    });

    expect(mockOverlayHandle).toHaveBeenCalledWith('data:image/png;base64,abc');
  });

  test('MOUNT_TRANSLATION_MODAL → calls translationModalHandler.handle(payload)', async () => {
    const payload = {
      id: 'tr-1',
      original: [
        {
          language: { code: 'ja-JP', name: 'Japanese' },
          text: 'こんにちは',
          romanization: 'konnichiwa',
          blockIndex: 0,
        },
      ],
      translated: [
        {
          language: { code: 'en-US', name: 'English' },
          text: 'Hello',
          romanization: null,
          blockIndex: 0,
        },
      ],
      description: 'A greeting',
      createdAt: '2026-01-01T00:00:00Z',
    };

    await callback({ action: 'MOUNT_TRANSLATION_MODAL', payload });

    expect(mockTranslationModalHandle).toHaveBeenCalledTimes(1);
  });

  test('THEME_CHANGED → dispatches without error', async () => {
    await callback({
      action: 'THEME_CHANGED',
      payload: { theme: 'dark' },
    });
  });

  test('SHOW_TOAST → calls toastHandler.show(payload)', async () => {
    const payload = { type: 'loading' as const, message: 'Translating...' };

    await callback({ action: 'SHOW_TOAST', payload });

    expect(mockToastShow).toHaveBeenCalledWith(payload);
  });

  test('DISMISS_TOAST → calls toastHandler.dismiss(id)', async () => {
    await callback({
      action: 'DISMISS_TOAST',
      payload: { id: 'toast-123' },
    });

    expect(mockToastDismiss).toHaveBeenCalledWith('toast-123');
  });

  test('PING → returns { action: "PONG" }', async () => {
    const result = await callback({ action: 'PING' });

    expect(result).toEqual({ action: 'PONG' });
  });

  test('invalid message (schema fail) → no handler called', async () => {
    await callback({ action: 'INVALID', data: 123 });

    expect(mockOverlayHandle).not.toHaveBeenCalled();
    expect(mockTranslationModalHandle).not.toHaveBeenCalled();
    expect(mockToastShow).not.toHaveBeenCalled();
  });
});
