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
import { createBackgroundRuntime } from '../../../../composition/background';
import { createBackgroundDependencies } from '../../../../composition/background';

const container = createBackgroundDependencies();

import type { Message } from '../../../../shared/messaging/MessageSchema';
import { resetBrowserMock } from '../../../../../tests/browser-mock';
import { TranslationJobCoordinator } from '../translation/TranslationJobCoordinator';
import { TranslationError } from '../../../../shared/errors';
import { success, failure } from '../../../../shared/types/Result';
import {
  VALID_IMAGE_BASE64,
  seedCredentialsAndPreferences,
} from '../../../../../tests/test-fixtures';

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

function getCallback() {
  const router = createBackgroundRuntime(container).messageRouter;

  router.register();

  return runtimeMessaging.onMessage.addListener.mock.calls[0][0] as (
    message: unknown,
    sender: browser.Runtime.MessageSender,
  ) => Promise<unknown>;
}

describe('Adapter: MessageRouter', () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    resetBrowserMock();
    fetchSpy = spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    mock.restore();
  });

  test('TRANSLATE_IMAGE routes a full logical job with trusted tab, frame, document and session identity', async () => {
    const handle = spyOn(
      TranslationJobCoordinator.prototype,
      'handle',
    ).mockResolvedValue(success(undefined));

    const callback = getCallback();

    const payload = {
      imageBase64: VALID_IMAGE_BASE64,
      requestId: 'router-request',
      documentSessionId: 'router-session',
    };

    const sender = {
      ...createSender(11),
      frameId: 3,
      documentId: 'document-3',
    };

    expect(
      await callback({ action: 'TRANSLATE_IMAGE', payload }, sender),
    ).toEqual(success(undefined));

    expect(handle).toHaveBeenCalledWith(payload, {
      tabId: 11,
      frameId: 3,
      documentId: 'document-3',
    });
  });

  test('TRANSLATE_IMAGE maps only safe final error fields', async () => {
    spyOn(TranslationJobCoordinator.prototype, 'handle').mockResolvedValue(
      failure(TranslationError.rateLimited()),
    );

    const callback = getCallback();

    const result = (await callback(
      {
        action: 'TRANSLATE_IMAGE',
        payload: {
          imageBase64: VALID_IMAGE_BASE64,
          requestId: 'router-request',
          documentSessionId: 'router-session',
        },
      },
      createSender(1),
    )) as { success: boolean; error?: { code: string } };

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TRANSLATION_RATE_LIMITED');

    expect(Object.keys(result.error ?? {}).toSorted()).toEqual([
      'code',
      'message',
      'userMessage',
    ]);

    expect(tabMessaging.sendMessage).not.toHaveBeenCalled();
  });

  test('cancel and status routes use the same trusted owner scope', async () => {
    const cancel = spyOn(
      TranslationJobCoordinator.prototype,
      'cancel',
    ).mockImplementation(() => {});

    const status = spyOn(
      TranslationJobCoordinator.prototype,
      'status',
    ).mockResolvedValue({ state: 'active' });

    const callback = getCallback();

    const payload = {
      requestId: 'router-request',
      documentSessionId: 'router-session',
    };

    const sender = { ...createSender(7), frameId: 4, documentId: 'doc' };

    await callback({ action: 'CANCEL_TRANSLATION', payload }, sender);

    expect(cancel).toHaveBeenCalledWith(payload, {
      tabId: 7,
      frameId: 4,
      documentId: 'doc',
    });

    expect(
      await callback({ action: 'GET_TRANSLATION_STATUS', payload }, sender),
    ).toEqual({ state: 'active' });

    expect(status).toHaveBeenCalledWith(payload, {
      tabId: 7,
      frameId: 4,
      documentId: 'doc',
    });

    expect(
      await callback(
        { action: 'GET_TRANSLATION_STATUS', payload },
        createSender(),
      ),
    ).toEqual({ state: 'unknown' });
  });

  test('legacy translation requests lacking request identity are rejected by validation', async () => {
    const handle = spyOn(TranslationJobCoordinator.prototype, 'handle');
    const callback = getCallback();

    expect(
      await callback(
        {
          action: 'TRANSLATE_IMAGE',
          payload: { imageBase64: VALID_IMAGE_BASE64 },
        },
        createSender(1),
      ),
    ).toBeUndefined();

    expect(handle).not.toHaveBeenCalled();
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
      payload: {
        imageBase64: VALID_IMAGE_BASE64,
        requestId: 'router-request',
        documentSessionId: 'router-session',
      },
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
