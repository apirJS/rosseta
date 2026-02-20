import {
  describe,
  expect,
  mock,
  spyOn,
  test,
  afterEach,
  beforeEach,
} from 'bun:test';
import * as browser from 'webextension-polyfill';
import { MessageRouter } from './MessageRouter';
import { container } from './di-container';
import type { Message } from '../../../shared/validation/MessageSchema';
import { resetBrowserMock } from '../../../../tests/browser-mock';
import {
  VALID_TRANSLATION_RESPONSE,
  VALID_IMAGE_BASE64,
  groqEnvelope,
  seedCredentialsAndPreferences,
} from '../../../../tests/test-fixtures';

const runtimeMessaging = browser.runtime as unknown as {
  onMessage: {
    addListener: ReturnType<typeof mock>;
  };
};

const tabMessaging = browser.tabs as unknown as {
  sendMessage: ReturnType<typeof mock>;
  query: ReturnType<typeof mock>;
  captureVisibleTab: ReturnType<typeof mock>;
};

function createSender(tabId?: number): browser.Runtime.MessageSender {
  return {
    id: 'fake-extension-id',
    url: 'https://example.com',
    frameId: 0,
    tab: tabId
      ? {
          id: tabId,
          index: 0,
          highlighted: true,
          active: true,
          incognito: false,
          pinned: false,
          url: 'https://example.com',
          title: 'Test Page',
          windowId: 1,
        }
      : undefined,
  };
}

describe('Adapter: MessageRouter', () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    resetBrowserMock();
    fetchSpy = spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function getCallback() {
    const router = new MessageRouter(container);
    router.register();
    return runtimeMessaging.onMessage.addListener.mock.calls[0][0] as (
      message: unknown,
      sender: browser.Runtime.MessageSender,
    ) => Promise<unknown>;
  }

  test('TRANSLATE_IMAGE → full pipeline succeeds → sends MOUNT_TRANSLATION_MODAL', async () => {
    seedCredentialsAndPreferences();
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(groqEnvelope(VALID_TRANSLATION_RESPONSE)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const callback = getCallback();
    const message: Message = {
      action: 'TRANSLATE_IMAGE',
      payload: { imageBase64: VALID_IMAGE_BASE64 },
    };

    await callback(message, createSender(1));

    const calls = tabMessaging.sendMessage.mock.calls;
    const modalCall = calls.find(
      (c: unknown[]) =>
        (c[1] as { action: string })?.action === 'MOUNT_TRANSLATION_MODAL',
    );
    expect(modalCall).toBeDefined();
  });

  test('TRANSLATE_IMAGE with no sender tab → returns BrowserError', async () => {
    seedCredentialsAndPreferences();

    const callback = getCallback();
    const message: Message = {
      action: 'TRANSLATE_IMAGE',
      payload: { imageBase64: VALID_IMAGE_BASE64 },
    };

    const result = (await callback(message, createSender())) as {
      success: boolean;
      error?: { code: string };
    };

    expect(result?.success).toBe(false);
  });

  test('START_OVERLAY → triggers overlay on active tab', async () => {
    seedCredentialsAndPreferences();
    tabMessaging.query.mockResolvedValue([{ id: 10 }]);
    tabMessaging.sendMessage.mockResolvedValueOnce({ type: 'PONG' }); // PING
    tabMessaging.captureVisibleTab.mockResolvedValueOnce(
      'data:image/jpeg;base64,img',
    );

    const callback = getCallback();
    await callback({ action: 'START_OVERLAY' }, createSender(1));

    const calls = tabMessaging.sendMessage.mock.calls;
    const overlayCall = calls.find(
      (c: unknown[]) =>
        (c[1] as { action: string })?.action === 'MOUNT_OVERLAY',
    );
    expect(overlayCall).toBeDefined();
  });

  test('MOUNT_HISTORY_MODAL → forwards payload to active tab', async () => {
    tabMessaging.query.mockResolvedValueOnce([{ id: 8 }]);
    tabMessaging.sendMessage.mockResolvedValue(undefined); // PING + content inject

    const callback = getCallback();
    const payload = {
      id: 'trans-1',
      original: [
        {
          language: { code: 'ja-JP', name: 'Japanese' },
          text: 'こんにちは',
          romanization: 'konnichiwa',
        },
      ],
      translated: [
        {
          language: { code: 'en-US', name: 'English' },
          text: 'Hello',
          romanization: null,
        },
      ],
      description: 'A greeting',
      createdAt: new Date(),
    };

    await callback({ action: 'MOUNT_HISTORY_MODAL', payload }, createSender(1));

    const calls = tabMessaging.sendMessage.mock.calls;
    const modalCall = calls.find(
      (c: unknown[]) =>
        (c[1] as { action: string })?.action === 'MOUNT_TRANSLATION_MODAL',
    );
    expect(modalCall).toBeDefined();
  });

  test('invalid message (schema fail) → undefined return, no handler called', async () => {
    const callback = getCallback();
    const result = await callback(
      { action: 'NONSENSE', payload: 123 },
      createSender(1),
    );

    expect(result).toBeUndefined();
    expect(tabMessaging.sendMessage).not.toHaveBeenCalled();
  });
});
