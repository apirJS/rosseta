import { afterEach, describe, expect, mock, test } from 'bun:test';
import { TranslationSession } from './TranslationSession';
import type { TranslationView } from '../../ui/injected/translation-result-modal/TranslationView';
import type {
  TranslationEvent,
  TranslationStatusResponse,
} from '../../../../shared/messaging/MessageSchema';

const identity = { requestId: 'request', documentSessionId: 'document' };

const draft = {
  segments: [
    {
      index: 0,
      blockIndex: null,
      originalText: 'こんに',
      translatedText: 'Hel',
      sourceLanguageCode: null,
      romanization: null,
    },
  ],
  description: null,
};

const sessions: TranslationSession[] = [];

afterEach(() => {
  for (const session of sessions.splice(0)) session.close();
});

function fixture(status: TranslationStatusResponse = { state: 'active' }) {
  const view: TranslationView = {
    started: mock(),
    reset: mock(),
    snapshot: mock(),
    committing: mock(),
    completed: mock(),
    failed: mock(),
    cancelled: mock(),
    dispose: mock(),
  };

  const cancel = mock(async () => {});
  let now = 0;
  let statusResult = status;

  const session = new TranslationSession(
    identity,
    view,
    { cancel, status: async () => statusResult, now: () => now },
    mock(),
  );

  sessions.push(session);

  const started: TranslationEvent = {
    ...identity,
    revision: 0,
    sequence: 0,
    kind: 'started',
    targetLanguage: { code: 'en-US', name: 'English' },
    generationDeadlineAt: 60_000,
  };

  return {
    session,
    view,
    cancel,
    started,
    setStatus: (value: TranslationStatusResponse) => {
      statusResult = value;
    },
    advance: (value: number) => {
      now = value;
      session.checkDeadline();
    },
  };
}

describe('Adapter: TranslationSession', () => {
  test('handles configuration failure before started', () => {
    const { session, view } = fixture();

    expect(
      session.accept({
        ...identity,
        revision: 0,
        sequence: 0,
        kind: 'failed',
        error: { code: 'AUTH', title: 'No key', userMessage: 'Add a key.' },
      }).status,
    ).toBe('accepted');

    expect(view.failed).toHaveBeenCalledTimes(1);
  });

  test('requires reset revision and rejects old, duplicate and wrong-document output', () => {
    const { session, started, view } = fixture();

    session.accept(started);

    const snapshot: TranslationEvent = {
      ...identity,
      revision: 1,
      sequence: 2,
      kind: 'snapshot',
      draft,
    };

    expect(session.accept(snapshot).status).toBe('stale');

    expect(
      session.accept({ ...identity, revision: 1, sequence: 1, kind: 'reset' })
        .status,
    ).toBe('accepted');

    expect(session.accept(snapshot).status).toBe('accepted');
    expect(session.accept(snapshot).status).toBe('stale');

    expect(
      session.accept({ ...snapshot, documentSessionId: 'another', sequence: 3 })
        .status,
    ).toBe('unknown');

    expect(view.snapshot).toHaveBeenCalledTimes(1);
  });

  test('close before start tombstones the session and cancels exactly once', () => {
    const { session, started, cancel, view } = fixture();

    session.close();
    session.close();
    expect(session.accept(started).status).toBe('closed');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(view.dispose).toHaveBeenCalledTimes(1);
  });

  test('commit-pending close still sends cancellation and resets cannot follow commit', () => {
    const { session, started, cancel } = fixture();

    session.accept(started);

    session.accept({
      ...identity,
      revision: 0,
      sequence: 1,
      kind: 'committing',
    });

    expect(
      session.accept({ ...identity, revision: 1, sequence: 2, kind: 'reset' })
        .status,
    ).toBe('stale');

    session.close();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test('absolute timeout stops spinner and refuses queued completion', () => {
    const { session, started, advance, view, cancel } = fixture();

    session.accept(started);
    advance(60_001);
    expect(view.failed).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);

    expect(
      session.accept({
        ...identity,
        revision: 0,
        sequence: 1,
        kind: 'cancelled',
      }).status,
    ).toBe('closed');
  });

  test('status recovery never enables copy from an unavailable final draft', async () => {
    const { session, view } = fixture({ state: 'completed-unavailable' });

    session.runtimeSettled();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(view.failed).toHaveBeenCalledTimes(1);
    expect(view.completed).not.toHaveBeenCalled();
  });

  test('resets preserve the absolute generation deadline', () => {
    const { session, started, advance, view } = fixture();

    session.accept(started);
    advance(59_000);
    session.accept({ ...identity, revision: 1, sequence: 1, kind: 'reset' });
    advance(60_001);
    expect(view.failed).toHaveBeenCalledTimes(1);
  });

  test('queued snapshots and resets cannot overwrite a committing preview', () => {
    const { session, started, view } = fixture();

    session.accept(started);
    session.accept({ ...identity, revision: 1, sequence: 1, kind: 'reset' });

    session.accept({
      ...identity,
      revision: 1,
      sequence: 2,
      kind: 'snapshot',
      draft,
    });

    session.accept({
      ...identity,
      revision: 1,
      sequence: 3,
      kind: 'committing',
    });

    expect(
      session.accept({
        ...identity,
        revision: 1,
        sequence: 4,
        kind: 'snapshot',
        draft,
      }).status,
    ).toBe('stale');

    expect(
      session.accept({ ...identity, revision: 2, sequence: 5, kind: 'reset' })
        .status,
    ).toBe('stale');

    expect(view.snapshot).toHaveBeenCalledTimes(1);
    expect(view.committing).toHaveBeenCalledTimes(1);
  });

  test('a lost background job terminates and sends cancellation only once', async () => {
    const { session, started, view, cancel } = fixture({ state: 'unknown' });

    session.accept(started);
    session.runtimeSettled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    session.runtimeFailed();
    session.close();
    expect(view.failed).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test('a recovered final result is authoritative and cannot be replaced by a late event', async () => {
    const translation = {
      id: 'saved',
      original: [
        {
          language: { code: 'ja-JP', name: 'Japanese' },
          text: 'source',
          romanization: null,
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
      description: '',
      createdAt: new Date(),
    };

    const { session, started, view } = fixture({
      state: 'completed',
      translation,
      historySaved: true,
    });

    session.accept(started);
    session.runtimeSettled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(view.completed).toHaveBeenCalledWith(translation, true);

    expect(
      session.accept({ ...identity, revision: 1, sequence: 1, kind: 'reset' })
        .status,
    ).toBe('stale');

    expect(view.reset).not.toHaveBeenCalled();
  });

  test('closing during status reconciliation ignores the queued final result', async () => {
    const { session, started, view, cancel, setStatus } = fixture();

    session.accept(started);
    setStatus({ state: 'completed-unavailable' });
    session.runtimeSettled();
    session.close();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(view.failed).not.toHaveBeenCalled();
    expect(view.completed).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
