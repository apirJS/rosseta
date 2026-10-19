import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { TranslationView } from '../services/TranslationSession';
import type { ThemeManager } from '../hosts/ThemeManager';
import type { TranslationViewMount } from './TranslationModalHandler';
import type { TranslationEvent } from '../../../../shared/validation/MessageSchema';

mock.module(
  '../../ui/injected/translation-result-modal/mountTranslationModal.svelte',
  () => ({
    mountTranslationModal: () => {
      throw new Error('Tests must inject their mount bridge');
    },
  }),
);
const { TranslationModalHandler } = await import('./TranslationModalHandler');
const handlers: InstanceType<typeof TranslationModalHandler>[] = [];

afterEach(() => {
  for (const handler of handlers.splice(0)) handler.dispose();
});

function fixture() {
  const views: TranslationView[] = [];
  const closes: (() => void)[] = [];
  const detach = mock();
  const cancel = mock(async () => {});
  const mount: TranslationViewMount = mock((_theme, _host, close) => {
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
    views.push(view);
    closes.push(close);
    return { view, detach };
  });
  const handler = new TranslationModalHandler({} as ThemeManager, mount, {
    cancel,
    status: async () => ({ state: 'active' }),
  });
  handlers.push(handler);
  return { handler, views, closes, mount, detach, cancel };
}

describe('Adapter: TranslationModalHandler', () => {
  test('unknown events never mount; registered events update the same view', () => {
    const { handler, mount, views } = fixture();
    const identity = { requestId: 'r', documentSessionId: handler.sessionId };
    const started: TranslationEvent = {
      ...identity,
      revision: 0,
      sequence: 0,
      kind: 'started',
      targetLanguage: { code: 'en-US', name: 'English' },
      generationDeadlineAt: Date.now() + 60_000,
    };
    expect(handler.receive(started).status).toBe('unknown');
    handler.register('r');
    expect(handler.receive(started).status).toBe('accepted');
    handler.receive({ ...identity, revision: 1, sequence: 1, kind: 'reset' });
    handler.receive({
      ...identity,
      revision: 1,
      sequence: 2,
      kind: 'snapshot',
      draft: { segments: [], description: null },
    });
    expect(mount).toHaveBeenCalledTimes(1);
    expect(views[0].snapshot).toHaveBeenCalledTimes(1);
  });

  test('closed and previous-document requests cannot recreate a modal', () => {
    const { handler, mount, closes, detach } = fixture();
    const identity = handler.register('closed');
    closes[0]();
    const event: TranslationEvent = {
      ...identity,
      revision: 0,
      sequence: 0,
      kind: 'cancelled',
    };
    expect(handler.receive(event).status).toBe('closed');
    handler.resetDocument();
    expect(handler.receive(event).status).toBe('unknown');
    expect(mount).toHaveBeenCalledTimes(1);
    expect(detach).toHaveBeenCalledTimes(1);
  });

  test('evicted closed tombstones remain unknown and never auto-mount', () => {
    const { handler, closes, mount } = fixture();
    const identity = handler.register('oldest');
    closes[0]();
    for (let i = 0; i < 501; i++) {
      handler.register('request-' + i);
      closes[i + 1]();
    }
    expect(
      handler.receive({
        ...identity,
        revision: 0,
        sequence: 0,
        kind: 'cancelled',
      }).status,
    ).toBe('unknown');
    expect(mount).toHaveBeenCalledTimes(502);
  });

  test('parallel requests keep drafts and cancellation isolated', () => {
    const { handler, views, closes, cancel } = fixture();
    const first = handler.register('first');
    const second = handler.register('second');
    for (const identity of [first, second]) {
      handler.receive({
        ...identity,
        revision: 0,
        sequence: 0,
        kind: 'started',
        targetLanguage: { code: 'en-US', name: 'English' },
        generationDeadlineAt: Date.now() + 60_000,
      });
      handler.receive({ ...identity, revision: 1, sequence: 1, kind: 'reset' });
    }
    handler.receive({
      ...first,
      revision: 1,
      sequence: 2,
      kind: 'snapshot',
      draft: { segments: [], description: 'First' },
    });
    closes[0]();
    handler.receive({
      ...second,
      revision: 1,
      sequence: 2,
      kind: 'snapshot',
      draft: { segments: [], description: 'Second' },
    });
    expect(views[0].snapshot).toHaveBeenCalledWith({
      segments: [],
      description: 'First',
    });
    expect(views[1].snapshot).toHaveBeenCalledWith({
      segments: [],
      description: 'Second',
    });
    expect(cancel).toHaveBeenCalledWith(first);
    expect(cancel).not.toHaveBeenCalledWith(second);
  });

  test('page restoration creates a new document identity and rejects queued old events', () => {
    const { handler, views, mount, cancel } = fixture();
    const oldIdentity = handler.register('request');
    handler.dispose();
    handler.resetDocument();
    const nextIdentity = handler.register('request');
    expect(nextIdentity.documentSessionId).not.toBe(
      oldIdentity.documentSessionId,
    );
    expect(
      handler.receive({
        ...oldIdentity,
        revision: 0,
        sequence: 0,
        kind: 'cancelled',
      }).status,
    ).toBe('unknown');
    expect(views[1].cancelled).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith(oldIdentity);
    expect(mount).toHaveBeenCalledTimes(2);
  });
});
