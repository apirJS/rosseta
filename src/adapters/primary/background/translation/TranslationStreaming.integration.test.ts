import type { TranslationView } from '../../ui/injected/translation-result-modal/TranslationView';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { APICallError } from 'ai';
import { resetBrowserMock } from '../../../../../tests/browser-mock';
import {
  coordinatorFixture,
  deferred,
  translationIdentity,
  translationOrigin,
} from '../../../../../tests/background-translation-fixtures';
import { FakeStreamingGeneration } from '../../../../../tests/fakes/FakeStreamingGeneration';
import { FakeTranslationCapabilityStorage } from '../../../../../tests/fakes/FakeTranslationCapabilityStorage';
import { VALID_IMAGE_BASE64 } from '../../../../../tests/test-fixtures';
import { TranslateImageUseCase } from '../../../../core/application/translation/TranslateImageUseCase';
import { TranslationSession } from '../../content/translation/TranslationSession';
import { executeTranslation } from '../../../secondary/translation/execute-translation';
import { TranslationJobCoordinator } from './TranslationJobCoordinator';
import type { TranslationEvent } from '../../../../shared/messaging/MessageSchema';

describe('Integration: streaming translation lifecycle', () => {
  const sessions: TranslationSession[] = [];

  afterEach(() => {
    for (const session of sessions.splice(0)) session.close();
    mock.restore();
  });

  test('previews before completion, resets through fallback and repair, saves once, and reuses the learned fallback', async () => {
    resetBrowserMock();

    const continueStream = deferred<void>();
    const previewReceived = deferred<void>();

    const response = {
      success: true,
      error: null,
      data: {
        segments: [
          {
            blockIndex: 0,
            originalText: 'source',
            translatedText: 'Hello',
            originalLanguageBcp47Code: 'en-US',
            romanization: null,
          },
        ],
        description: '',
      },
    };

    const final = {
      text: JSON.stringify(response),
      finishReason: 'stop',
      schemaValidated: false,
    };

    const transport = new FakeStreamingGeneration([
      {
        error: new APICallError({
          message: 'json_schema is not supported',
          statusCode: 400,
          url: 'https://fixture.invalid',
          requestBodyValues: {},
        }),
      },
      {
        events: [
          {
            type: 'text',
            text: '{"success":true,"data":{"segments":[{"originalText":"source","translatedText":"Hel',
          },
        ],
        wait: continueStream.promise,
        result: {
          text: 'malformed',
          finishReason: 'stop',
          schemaValidated: false,
        },
      },
      { result: final },
      { result: final },
    ]);

    const capabilities = new FakeTranslationCapabilityStorage();

    const useCase = new TranslateImageUseCase({
      translateImage: (image, language, options) =>
        executeTranslation(
          transport,
          {
            providerId: 'openai',
            modelId: 'fixture',
            protocol: 'fixture',
            baseURL: 'https://fixture.invalid',
          },
          image,
          language,
          true,
          capabilities,
          options,
        ),
    });

    const fixture = coordinatorFixture((command) => useCase.execute(command));

    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );

    const views = new Map<string, TranslationView>();
    const active = new Map<string, TranslationSession>();
    const events: TranslationEvent[] = [];

    const tabs = browser.tabs as unknown as {
      sendMessage: ReturnType<typeof mock>;
    };

    tabs.sendMessage.mockImplementation(
      async (_tab: number, message: { payload: TranslationEvent }) => {
        events.push(message.payload);

        return (
          active.get(message.payload.requestId)?.accept(message.payload) ?? {
            status: 'unknown',
          }
        );
      },
    );

    const register = (requestId: string) => {
      const identity = { ...translationIdentity, requestId };

      const view: TranslationView = {
        started: mock(),
        reset: mock(),
        snapshot: mock(() => previewReceived.resolve()),
        committing: mock(),
        completed: mock(),
        failed: mock(),
        cancelled: mock(),
        dispose: mock(),
      };

      const session = new TranslationSession(
        identity,
        view,
        {
          cancel: async (value) => coordinator.cancel(value, translationOrigin),
          status: (value) => coordinator.status(value, translationOrigin),
        },
        () => {},
      );

      sessions.push(session);
      active.set(requestId, session);
      views.set(requestId, view);

      return identity;
    };

    const identity = register('first');

    const running = coordinator.handle(
      { ...identity, imageBase64: VALID_IMAGE_BASE64 },
      translationOrigin,
    );

    await previewReceived.promise;
    expect(fixture.storage.storedCount).toBe(0);
    expect(views.get('first')?.completed).not.toHaveBeenCalled();

    const draft = events.find((event) => event.kind === 'snapshot');

    expect(
      draft?.kind === 'snapshot' && draft.draft.segments[0].translatedText,
    ).toBe('Hel');

    continueStream.resolve();
    expect((await running).success).toBe(true);

    expect(transport.requests.map((request) => request.mode)).toEqual([
      'structured-stream',
      'plain-stream',
      'plain-buffered',
    ]);

    expect(views.get('first')?.reset).toHaveBeenCalledTimes(3);

    expect(transport.requests[2].userText).toContain(
      'untrusted_previous_response',
    );

    expect(views.get('first')?.completed).toHaveBeenCalledTimes(1);
    expect(fixture.storage.storedCount).toBe(1);

    const second = register('second');

    expect(
      (
        await coordinator.handle(
          { ...second, imageBase64: VALID_IMAGE_BASE64 },
          translationOrigin,
        )
      ).success,
    ).toBe(true);

    expect(transport.requests.at(-1)?.mode).toBe('plain-buffered');
    expect(transport.requests).toHaveLength(4);
    expect(fixture.storage.storedCount).toBe(2);
    expect(views.get('second')?.completed).toHaveBeenCalledTimes(1);
  });
});
