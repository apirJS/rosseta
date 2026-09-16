import {
  describe,
  expect,
  test,
  mock,
  spyOn,
  beforeEach,
  afterEach,
} from 'bun:test';
import * as browser from 'webextension-polyfill';
import { APICallError } from 'ai';
import { MessageRouter } from './MessageRouter';
import { container } from './di-container';
import { OverlayService } from './services/OverlayService';
import type { Message } from '../../../shared/validation/MessageSchema';
import { resetBrowserMock, generateTextMock } from '../../../../tests/browser-mock';
import {
  VALID_TRANSLATION_RESPONSE,
  VALID_IMAGE_BASE64,
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
    const overlayService = new OverlayService(container);
    const router = new MessageRouter(container, overlayService);
    router.register();
    return runtimeMessaging.onMessage.addListener.mock.calls[0][0] as (
      message: unknown,
      sender: browser.Runtime.MessageSender,
    ) => Promise<unknown>;
  }

  test('TRANSLATE_IMAGE → full pipeline succeeds → sends MOUNT_TRANSLATION_MODAL', async () => {
    seedCredentialsAndPreferences();
    generateTextMock.mockResolvedValueOnce({
      output: VALID_TRANSLATION_RESPONSE,
    });

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

  test('TRANSLATE_IMAGE → provider failure → error toast, no modal', async () => {
    seedCredentialsAndPreferences();
    generateTextMock.mockRejectedValueOnce(
      new APICallError({
        message: 'Rate limit exceeded',
        url: 'https://api.test',
        requestBodyValues: {},
        statusCode: 429,
      }),
    );

    const callback = getCallback();
    const message: Message = {
      action: 'TRANSLATE_IMAGE',
      payload: { imageBase64: VALID_IMAGE_BASE64 },
    };

    const result = (await callback(message, createSender(1))) as {
      success: boolean;
    };

    expect(result?.success).toBe(false);
    const calls = tabMessaging.sendMessage.mock.calls;
    const modalCall = calls.find(
      (c: unknown[]) =>
        (c[1] as { action: string })?.action === 'MOUNT_TRANSLATION_MODAL',
    );
    expect(modalCall).toBeUndefined();
    const errorToastCall = calls.find(
      (c: unknown[]) =>
        (c[1] as { action: string })?.action === 'SHOW_TOAST' &&
        (c[1] as { payload?: { type?: string } })?.payload?.type === 'error',
    );
    expect(errorToastCall).toBeDefined();
  });

  test('FETCH_MODELS → resolves provider key, fetches, persists, returns models', async () => {
    seedCredentialsAndPreferences('groq');
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: 'llama-4-scout', object: 'model' },
            { id: 'llama-4-maverick', object: 'model' },
          ],
        }),
        { status: 200 },
      ),
    );

    const callback = getCallback();
    const result = (await callback(
      { action: 'FETCH_MODELS', payload: { provider: 'groq' } },
      createSender(1),
    )) as { success: boolean; models?: Array<{ id: string }> };

    expect(result?.success).toBe(true);
    expect(result?.models?.map((m) => m.id)).toEqual([
      'llama-4-maverick',
      'llama-4-scout',
    ]);
  });

  test('FETCH_MODELS → no key for provider → auth error response', async () => {
    seedCredentialsAndPreferences('google');

    const callback = getCallback();
    const result = (await callback(
      { action: 'FETCH_MODELS', payload: { provider: 'groq' } },
      createSender(1),
    )) as { success: boolean; error?: { code: string } };

    expect(result?.success).toBe(false);
    expect(result?.error?.code).toBe('AUTH_NOT_AUTHENTICATED');
  });

  test('FETCH_MODELS → unknown provider → validation error response', async () => {
    const callback = getCallback();
    const result = (await callback(
      { action: 'FETCH_MODELS', payload: { provider: 'foobar' } },
      createSender(1),
    )) as { success: boolean; error?: { code: string } };

    expect(result?.success).toBe(false);
    expect(result?.error?.code).toBe('VALIDATION_INVALID_INPUT');
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
    tabMessaging.sendMessage.mockResolvedValueOnce({ type: 'PONG' });
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
    tabMessaging.sendMessage.mockResolvedValue(undefined);

    const callback = getCallback();
    const payload = {
      id: 'trans-1',
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
