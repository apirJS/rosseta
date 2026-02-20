// IMPORTANT: mock.module must run before any module import
import { resetBrowserMock } from '../../tests/browser-mock';
import { describe, test, expect, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { sendMessageToRuntime, sendMessageToTab } from './messaging';

const runtime = browser.runtime as unknown as {
  sendMessage: ReturnType<typeof import('bun:test').mock>;
};

const tabs = browser.tabs as unknown as {
  sendMessage: ReturnType<typeof import('bun:test').mock>;
};

describe('Shared: messaging', () => {
  beforeEach(() => resetBrowserMock());

  // ── sendMessageToRuntime ───────────────────────────────────

  test('sendMessageToRuntime delegates to browser.runtime.sendMessage', async () => {
    await sendMessageToRuntime({ action: 'START_OVERLAY' });

    expect(runtime.sendMessage).toHaveBeenCalledWith({
      action: 'START_OVERLAY',
    });
  });

  test('sendMessageToRuntime passes action with payload', async () => {
    await sendMessageToRuntime({
      action: 'TRANSLATE_IMAGE',
      payload: { imageBase64: 'data:test' },
    });

    expect(runtime.sendMessage).toHaveBeenCalledWith({
      action: 'TRANSLATE_IMAGE',
      payload: { imageBase64: 'data:test' },
    });
  });

  test('sendMessageToRuntime returns response from runtime', async () => {
    runtime.sendMessage.mockResolvedValueOnce({ action: 'PONG' });

    const result = await sendMessageToRuntime({ action: 'PING' });

    expect(result).toEqual({ action: 'PONG' });
  });

  // ── sendMessageToTab ───────────────────────────────────────

  test('sendMessageToTab delegates to browser.tabs.sendMessage', async () => {
    await sendMessageToTab(42, {
      action: 'SHOW_TOAST',
      payload: { type: 'success', message: 'Done' },
    });

    expect(tabs.sendMessage).toHaveBeenCalledWith(42, {
      action: 'SHOW_TOAST',
      payload: { type: 'success', message: 'Done' },
    });
  });
});
