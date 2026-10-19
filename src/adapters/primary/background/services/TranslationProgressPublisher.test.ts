import { describe, expect, mock, test } from 'bun:test';
import { TranslationProgressPublisher } from './TranslationProgressPublisher';
import { AbortCancellationToken } from './AbortCancellationToken';
import type {
  TranslationAcknowledgement,
  TranslationEvent,
} from '../../../../shared/validation/MessageSchema';
import {
  deferred,
  nextTurn,
  translationDraft,
  translationIdentity,
  translationOrigin,
} from '../../../../../tests/background-translation-fixtures';

const accepted: TranslationAcknowledgement = { status: 'accepted' };
const pause = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));

function publisherFixture(
  sender?: (event: TranslationEvent) => Promise<TranslationAcknowledgement>,
  deadline = Date.now() + 60_000,
) {
  const token = new AbortCancellationToken();
  const send = mock(sender ?? (async () => accepted));
  return {
    token,
    send,
    publisher: new TranslationProgressPublisher(
      translationIdentity,
      translationOrigin,
      token,
      deadline,
      send,
    ),
  };
}

describe('Service: TranslationProgressPublisher', () => {
  test('requires reset acknowledgement and allocates increasing display sequence and revision', async () => {
    const ack = deferred<TranslationAcknowledgement>();
    const { publisher, send } = publisherFixture(async (event) =>
      event.kind === 'reset' ? ack.promise : accepted,
    );
    await publisher.control({
      kind: 'started',
      targetLanguage: { code: 'en-US', name: 'English' },
      generationDeadlineAt: Date.now() + 60_000,
    });
    let resetSettled = false;
    const resetting = publisher.report({ kind: 'reset' }).then((result) => {
      resetSettled = true;
      return result;
    });
    await nextTurn();
    expect(resetSettled).toBe(false);
    ack.resolve(accepted);
    expect((await resetting).success).toBe(true);
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('Hel'),
    });
    await nextTurn();
    await publisher.control({ kind: 'committing' });
    const events = send.mock.calls.map((call) => call[0]);
    expect(
      events.map((event) => [event.kind, event.revision, event.sequence]),
    ).toEqual([
      ['started', 0, 1],
      ['reset', 1, 2],
      ['snapshot', 1, 3],
      ['committing', 1, 4],
    ]);
    publisher.dispose();
  });

  test('coalesces snapshots to the latest text, emits the first immediately, and suppresses duplicates', async () => {
    const { publisher, send } = publisherFixture();
    await publisher.report({ kind: 'reset' });
    await publisher.report({ kind: 'snapshot', draft: translationDraft('H') });
    await nextTurn();
    expect(send.mock.calls.map((call) => call[0].kind)).toEqual([
      'reset',
      'snapshot',
    ]);
    await publisher.report({ kind: 'snapshot', draft: translationDraft('He') });
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('Hel'),
    });
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('Hello'),
    });
    await pause(90);
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('Hello'),
    });
    await publisher.control({ kind: 'committing' });
    const texts = send.mock.calls
      .map((call) => call[0])
      .filter((event) => event.kind === 'snapshot')
      .map((event) => event.draft.segments[0]?.translatedText);
    expect(texts).toEqual(['H', 'Hello']);
    publisher.dispose();
  });

  test('a reset discards the pending snapshot and starts a fresh revision', async () => {
    const { publisher, send } = publisherFixture();
    await publisher.report({ kind: 'reset' });
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('old-first'),
    });
    await nextTurn();
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('old-pending'),
    });
    await publisher.report({ kind: 'reset' });
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('replacement'),
    });
    await nextTurn();
    const events = send.mock.calls.map((call) => call[0]);
    expect(
      events
        .filter((event) => event.kind === 'snapshot')
        .map((event) => event.draft.segments[0]?.translatedText),
    ).toEqual(['old-first', 'replacement']);
    expect(events.at(-1)?.revision).toBe(2);
    publisher.dispose();
  });

  test('keeps only the newest pending snapshot while another delivery waits for ACK', async () => {
    const ack = deferred<TranslationAcknowledgement>();
    let snapshots = 0;
    const { publisher, send } = publisherFixture(async (event) =>
      event.kind === 'snapshot' && ++snapshots === 1 ? ack.promise : accepted,
    );
    await publisher.report({ kind: 'reset' });
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('first'),
    });
    await nextTurn();
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('obsolete'),
    });
    await pause(85);
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('latest'),
    });
    await pause(85);
    ack.resolve(accepted);
    await pause(90);
    await publisher.control({ kind: 'committing' });
    expect(
      send.mock.calls
        .map((call) => call[0])
        .filter((event) => event.kind === 'snapshot')
        .map((event) => event.draft.segments[0]?.translatedText),
    ).toEqual(['first', 'latest']);
    publisher.dispose();
  });

  test.each(['closed', 'unknown'] as const)(
    '%s ACK cancels the job and prevents subsequent sends',
    async (status) => {
      const { publisher, token, send } = publisherFixture(async () => ({
        status,
      }));
      expect((await publisher.report({ kind: 'reset' })).success).toBe(false);
      expect(token.isCancellationRequested).toBe(true);
      expect(
        (
          await publisher.report({
            kind: 'snapshot',
            draft: translationDraft('late'),
          })
        ).success,
      ).toBe(false);
      expect(send).toHaveBeenCalledTimes(1);
      publisher.dispose();
    },
  );

  test('stale ACK drops the event without restarting generation or cancelling', async () => {
    const { publisher, token } = publisherFixture(async (event) => ({
      status: event.kind === 'snapshot' ? 'stale' : 'accepted',
    }));
    expect((await publisher.report({ kind: 'reset' })).success).toBe(true);
    await publisher.report({ kind: 'snapshot', draft: translationDraft('H') });
    await nextTurn();
    expect(token.isCancellationRequested).toBe(false);
    publisher.dispose();
  });

  test('a stale reset ACK cannot authorize replacement generation', async () => {
    const { publisher, token } = publisherFixture(async () => ({
      status: 'stale',
    }));
    expect((await publisher.report({ kind: 'reset' })).success).toBe(false);
    expect(token.isCancellationRequested).toBe(true);
    publisher.dispose();
  });

  test('bounds a hanging snapshot by the generation deadline and consumes its late rejection', async () => {
    const hanging = deferred<TranslationAcknowledgement>();
    const { publisher, token } = publisherFixture(
      async (event) => (event.kind === 'snapshot' ? hanging.promise : accepted),
      Date.now() + 25,
    );
    await publisher.report({ kind: 'reset' });
    await publisher.report({ kind: 'snapshot', draft: translationDraft('H') });
    await pause(40);
    expect(token.isCancellationRequested).toBe(true);
    expect(publisher.error).toBeDefined();
    expect((await publisher.control({ kind: 'committing' })).success).toBe(
      false,
    );
    hanging.reject(new Error('late disconnected receiver'));
    await nextTurn();
    publisher.dispose();
  });

  test('dispose clears pending work and refuses progress', async () => {
    const { publisher, send } = publisherFixture();
    await publisher.report({ kind: 'reset' });
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('first'),
    });
    await nextTurn();
    await publisher.report({
      kind: 'snapshot',
      draft: translationDraft('pending'),
    });
    publisher.dispose();
    await pause(85);
    expect(
      send.mock.calls.filter((call) => call[0].kind === 'snapshot'),
    ).toHaveLength(1);
    expect((await publisher.report({ kind: 'reset' })).success).toBe(false);
  });
});
