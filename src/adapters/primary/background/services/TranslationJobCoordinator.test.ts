import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import * as browser from 'webextension-polyfill';
import { resetBrowserMock } from '../../../../../tests/browser-mock';
import {
  coordinatorFixture,
  completeTranslation,
  deferred,
  nextTurn,
  sentTranslationEvents,
  translationDraft,
  translationIdentity as identity,
  translationOrigin as origin,
} from '../../../../../tests/background-translation-fixtures';
import { TranslationJobCoordinator } from './TranslationJobCoordinator';
import { failure, success, type Result } from '../../../../shared/types/Result';
import {
  AuthError,
  ErrorCode,
  StorageError,
  TranslationError,
  type AppError,
} from '../../../../shared/errors';
import type { Translation } from '../../../../core/domain/translation/Translation';
import type { TranslateImageCommand } from '../../../../core/ports/inbound/translation/ITranslateImageUseCase';
import type {
  TranslationAcknowledgement,
  TranslationEvent,
} from '../../../../shared/validation/MessageSchema';
import { VALID_IMAGE_BASE64 } from '../../../../../tests/test-fixtures';

const tabs = browser.tabs as unknown as {
  sendMessage: ReturnType<typeof mock>;
  query: ReturnType<typeof mock>;
};
const payload = { ...identity, imageBase64: VALID_IMAGE_BASE64 };
const accepted: TranslationAcknowledgement = { status: 'accepted' };

describe('Service: TranslationJobCoordinator', () => {
  beforeEach(() => {
    resetBrowserMock();
    tabs.sendMessage.mockImplementation(async () => accepted);
  });
  afterEach(() => mock.restore());

  test('handshakes, forwards the same deadline, publishes a draft, and saves only the final domain result', async () => {
    let command: TranslateImageCommand | undefined;
    const fixture = coordinatorFixture(async (value) => {
      command = value;

      await value.progress?.report({ kind: 'reset' });
      await value.progress?.report({
        kind: 'snapshot',
        draft: translationDraft('Hel'),
      });
      await nextTurn();

      expect(fixture.storage.storedCount).toBe(0);

      return success(completeTranslation());
    });
    const result = await new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    ).handle(payload, origin);

    expect(result.success).toBe(true);
    expect(fixture.storage.storedCount).toBe(1);
    expect(fixture.generation).toHaveBeenCalledTimes(1);

    const events = sentTranslationEvents(tabs.sendMessage.mock.calls);
    expect(events.map((event) => event.kind)).toEqual([
      'started',
      'reset',
      'snapshot',
      'committing',
      'completed',
    ]);

    const started = events[0];
    if (started?.kind !== 'started') throw new Error('Missing started event');

    expect(command?.generationDeadlineAt).toBe(started.generationDeadlineAt);
    expect(command?.cancellationToken).toBeDefined();
    expect(
      tabs.sendMessage.mock.calls.every(
        (call) =>
          call[0] === origin.tabId &&
          (call[2] as { documentId?: string })?.documentId ===
            origin.documentId,
      ),
    ).toBe(true);
    expect(tabs.query).not.toHaveBeenCalled();
  });

  test('does not generate until the origin accepts started', async () => {
    const ack = deferred<TranslationAcknowledgement>();
    tabs.sendMessage.mockImplementation(
      async (_tab: number, message: { payload: TranslationEvent }) =>
        message.payload.kind === 'started' ? ack.promise : accepted,
    );

    const fixture = coordinatorFixture();
    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );
    const result = coordinator.handle(payload, origin);

    await nextTurn();

    expect(fixture.generation).not.toHaveBeenCalled();
    expect(await coordinator.status(identity, origin)).toEqual({
      state: 'active',
    });

    ack.resolve(accepted);
    expect((await result).success).toBe(true);
  });

  test('duplicates reuse the active promise and completed summary without duplicate generation or save', async () => {
    const generated = deferred<Result<Translation, AppError>>();
    const fixture = coordinatorFixture(async () => generated.promise);
    const save = spyOn(fixture.saveTranslationUseCase, 'execute');
    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );
    const first = coordinator.handle(payload, origin);

    expect(coordinator.handle(payload, origin)).toBe(first);

    await nextTurn();
    generated.resolve(success(completeTranslation()));

    expect((await first).success).toBe(true);
    expect((await coordinator.handle(payload, origin)).success).toBe(true);
    expect(fixture.generation).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test('cancellation before registration suppresses all preparation and generation', async () => {
    const fixture = coordinatorFixture();
    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );

    coordinator.cancel(identity, origin);

    const result = await coordinator.handle(payload, origin);
    expect(result.success).toBe(false);

    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_CANCELLED);

    expect(fixture.prepare).not.toHaveBeenCalled();
    expect(fixture.generation).not.toHaveBeenCalled();
    expect(tabs.sendMessage).not.toHaveBeenCalled();
  });

  test('owner cancellation settles promptly and ignores late provider completion', async () => {
    const generated = deferred<Result<Translation, AppError>>();
    const fixture = coordinatorFixture(async () => generated.promise);
    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );
    const running = coordinator.handle(payload, origin);

    await nextTurn();
    coordinator.cancel(identity, { ...origin, frameId: origin.frameId + 1 });
    expect(await coordinator.status(identity, origin)).toEqual({
      state: 'active',
    });
    coordinator.cancel(identity, origin);

    const result = await running;
    expect(result.success).toBe(false);

    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_CANCELLED);

    generated.resolve(success(completeTranslation()));
    await nextTurn();

    expect(fixture.storage.storedCount).toBe(0);
    expect(await coordinator.status(identity, origin)).toEqual({
      state: 'cancelled',
    });
    expect(
      sentTranslationEvents(tabs.sendMessage.mock.calls).some(
        (event) => event.kind === 'completed',
      ),
    ).toBe(false);
  });

  test('parallel jobs keep drafts, cancellation, completion, and persistence isolated', async () => {
    const firstGenerated = deferred<Result<Translation, AppError>>();
    const secondGenerated = deferred<Result<Translation, AppError>>();
    let invocation = 0;
    const fixture = coordinatorFixture(async (command) => {
      const current = ++invocation;
      await command.progress?.report({ kind: 'reset' });
      await command.progress?.report({
        kind: 'snapshot',
        draft: translationDraft(current === 1 ? 'First' : 'Second'),
      });
      return current === 1 ? firstGenerated.promise : secondGenerated.promise;
    });
    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );
    const secondIdentity = { ...identity, requestId: 'request-2' };
    const first = coordinator.handle(payload, origin);
    const second = coordinator.handle(
      { ...payload, ...secondIdentity },
      origin,
    );

    await nextTurn();

    coordinator.cancel(identity, origin);
    secondGenerated.resolve(success(completeTranslation('translation-2')));

    expect((await first).success).toBe(false);
    expect((await second).success).toBe(true);

    firstGenerated.resolve(success(completeTranslation('translation-late')));
    await nextTurn();

    const stored = await fixture.storage.getAll();
    expect(
      stored.success && stored.data.map((translation) => translation.id),
    ).toEqual(['translation-2']);
    expect(await coordinator.status(identity, origin)).toEqual({
      state: 'cancelled',
    });
    expect((await coordinator.status(secondIdentity, origin)).state).toBe(
      'completed',
    );

    const events = sentTranslationEvents(tabs.sendMessage.mock.calls);
    expect(
      events
        .filter((event) => event.requestId === identity.requestId)
        .some((event) => event.kind === 'completed'),
    ).toBe(false);
    expect(
      events
        .filter((event) => event.requestId === secondIdentity.requestId)
        .some((event) => event.kind === 'completed'),
    ).toBe(true);

    for (const requestId of [identity.requestId, secondIdentity.requestId]) {
      const sequences = events
        .filter((event) => event.requestId === requestId)
        .map((event) => event.sequence);
      expect(sequences).toEqual(sequences.toSorted((a, b) => a - b));
      expect(new Set(sequences).size).toBe(sequences.length);
    }
  });

  test('the generation deadline stops blocked work and prevents late completion from saving', async () => {
    const generated = deferred<Result<Translation, AppError>>();
    const fixture = coordinatorFixture(async (command) => {
      if (command.generationDeadlineAt === undefined)
        throw new Error('Missing generation deadline');
      spyOn(Date, 'now').mockReturnValue(command.generationDeadlineAt + 1);
      return generated.promise;
    });
    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );
    const result = await coordinator.handle(payload, origin);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    generated.resolve(success(completeTranslation('late')));
    await nextTurn();
    expect(fixture.storage.storedCount).toBe(0);
    const state = await coordinator.status(identity, origin);
    expect(state.state).toBe('failed');
    if (state.state === 'failed')
      expect(state.error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    expect(
      sentTranslationEvents(tabs.sendMessage.mock.calls).some(
        (event) => event.kind === 'completed',
      ),
    ).toBe(false);
  });

  test('cancellation during committing ACK still prevents persistence', async () => {
    const ack = deferred<TranslationAcknowledgement>();
    tabs.sendMessage.mockImplementation(
      async (_tab: number, message: { payload: TranslationEvent }) =>
        message.payload.kind === 'committing' ? ack.promise : accepted,
    );
    const fixture = coordinatorFixture();
    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );
    const running = coordinator.handle(payload, origin);
    await nextTurn();
    coordinator.cancel(identity, origin);
    ack.resolve(accepted);
    expect((await running).success).toBe(false);
    expect(fixture.storage.storedCount).toBe(0);
  });

  test('cancellation after crossing commit cannot roll back the saved final result', async () => {
    const saveGate = deferred<void>();
    const fixture = coordinatorFixture();

    spyOn(fixture.saveTranslationUseCase, 'execute').mockImplementation(
      async ({ translation }) => {
        await saveGate.promise;
        fixture.storage.seed(translation);
        return success(undefined);
      },
    );

    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );
    const running = coordinator.handle(payload, origin);

    await nextTurn();

    expect(await coordinator.status(identity, origin)).toEqual({
      state: 'committing',
    });

    coordinator.cancel(identity, origin);
    saveGate.resolve();

    expect((await running).success).toBe(true);
    expect(fixture.storage.storedCount).toBe(1);
    expect((await coordinator.status(identity, origin)).state).toBe(
      'completed',
    );
  });

  test('save failure completes valid output with historySaved false and no draft-based recovery', async () => {
    const fixture = coordinatorFixture();
    fixture.storage.failNextCallWith(StorageError.writeFailed('translations'));
    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );

    expect((await coordinator.handle(payload, origin)).success).toBe(true);
    const completed = sentTranslationEvents(tabs.sendMessage.mock.calls).find(
      (event) => event.kind === 'completed',
    );
    expect(completed?.kind === 'completed' && completed.historySaved).toBe(
      false,
    );
    expect(await coordinator.status(identity, origin)).toEqual({
      state: 'completed-unavailable',
    });
  });

  test('saved completion reconciles after delivery failure; another owner or deleted history cannot recover it', async () => {
    tabs.sendMessage.mockImplementation(
      async (_tab: number, message: { payload: TranslationEvent }) => ({
        status: message.payload.kind === 'completed' ? 'closed' : 'accepted',
      }),
    );
    const fixture = coordinatorFixture();
    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );
    expect((await coordinator.handle(payload, origin)).success).toBe(true);
    const recovered = await coordinator.status(identity, origin);
    expect(recovered.state).toBe('completed');
    if (recovered.state === 'completed')
      expect(recovered.translation.translated[0]?.text).toBe('Hello');
    expect(
      await coordinator.status(identity, {
        ...origin,
        documentId: 'new-document',
      }),
    ).toEqual({ state: 'unknown' });
    await fixture.storage.delete('translation-1');
    expect(await coordinator.status(identity, origin)).toEqual({
      state: 'completed-unavailable',
    });
  });

  test('closed started ACK prevents provider calls and history writes', async () => {
    tabs.sendMessage.mockResolvedValue({ status: 'closed' });
    const fixture = coordinatorFixture();
    expect(
      (
        await new TranslationJobCoordinator(
          fixture.container,
          fixture.preparer,
        ).handle(payload, origin)
      ).success,
    ).toBe(false);
    expect(fixture.generation).not.toHaveBeenCalled();
    expect(fixture.storage.storedCount).toBe(0);
  });

  test('configuration failure is safe and never includes the screenshot or error context', async () => {
    const fixture = coordinatorFixture();
    const coordinator = new TranslationJobCoordinator(fixture.container, {
      prepare: async () => failure(AuthError.notAuthenticated()),
    });
    expect((await coordinator.handle(payload, origin)).success).toBe(false);
    expect(fixture.generation).not.toHaveBeenCalled();

    const events = sentTranslationEvents(tabs.sendMessage.mock.calls);
    expect(events.map((event) => event.kind)).toEqual(['failed']);

    const failed = events[0];
    expect(
      failed?.kind === 'failed' && Object.keys(failed.error).toSorted(),
    ).toEqual(['code', 'title', 'userMessage']);
    expect(JSON.stringify(events)).not.toContain(VALID_IMAGE_BASE64);
  });

  test('a duplicate failed request preserves its error code without generating or saving again', async () => {
    const error = TranslationError.rateLimited();
    const fixture = coordinatorFixture(async () => failure(error));
    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );
    const first = await coordinator.handle(payload, origin);
    const delivered = tabs.sendMessage.mock.calls.length;
    const duplicate = await coordinator.handle(payload, origin);

    expect(first.success).toBe(false);
    expect(duplicate.success).toBe(false);

    if (!duplicate.success) {
      expect(duplicate.error.code).toBe(error.code);
      expect(duplicate.error.userMessage).toBe(error.userMessage);
    }

    expect(fixture.generation).toHaveBeenCalledTimes(1);
    expect(fixture.storage.storedCount).toBe(0);
    expect(tabs.sendMessage.mock.calls.length).toBe(delivered);
  });

  test('provider errors finish failed and never persist partial results', async () => {
    const fixture = coordinatorFixture(async (command) => {
      await command.progress?.report({ kind: 'reset' });
      await command.progress?.report({
        kind: 'snapshot',
        draft: translationDraft('Hel'),
      });
      return failure(TranslationError.rateLimited());
    });

    const coordinator = new TranslationJobCoordinator(
      fixture.container,
      fixture.preparer,
    );

    const result = await coordinator.handle(payload, origin);
    expect(result.success).toBe(false);

    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_RATE_LIMITED);

    expect(fixture.storage.storedCount).toBe(0);
    expect((await coordinator.status(identity, origin)).state).toBe('failed');
  });
});
