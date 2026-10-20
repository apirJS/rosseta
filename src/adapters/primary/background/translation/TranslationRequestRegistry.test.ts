import { describe, expect, test } from 'bun:test';
import { TranslationRequestRegistry } from './TranslationRequestRegistry';
import { success } from '../../../../shared/types/Result';
import {
  translationIdentity as identity,
  translationOrigin as origin,
} from '../../../../../tests/background-translation-fixtures';

describe('Service: TranslationRequestRegistry', () => {
  test('keeps ownership scoped by tab, frame, document, and content session', () => {
    const registry = new TranslationRequestRegistry();
    const job = registry.create(identity, origin);

    expect(registry.get(identity, origin)).toBe(job);

    for (const wrong of [
      { ...origin, tabId: 12 },
      { ...origin, frameId: 4 },
      { ...origin, documentId: 'other' },
    ]) {
      registry.cancel(identity, wrong);
      expect(registry.get(identity, wrong)).toBeUndefined();
      expect(job.token.isCancellationRequested).toBe(false);
    }

    registry.cancel({ ...identity, documentSessionId: 'other' }, origin);
    expect(job.token.isCancellationRequested).toBe(false);
    registry.cancel(identity, origin);
    expect(job.token.isCancellationRequested).toBe(true);
  });

  test('remembers cancellation before registration without affecting other owners', () => {
    let now = 1;
    const registry = new TranslationRequestRegistry(() => now);

    registry.cancel(identity, origin);
    expect(registry.wasCancelled(identity, origin)).toBe(true);

    expect(registry.wasCancelled(identity, { ...origin, frameId: 0 })).toBe(
      false,
    );

    now += 120_000;
    expect(registry.wasCancelled(identity, origin)).toBe(false);
  });

  test('ignores cancellation after the atomic commit boundary', async () => {
    const registry = new TranslationRequestRegistry();
    const job = registry.create(identity, origin);

    job.phase = 'committing';
    registry.cancel(identity, origin);
    expect(job.token.isCancellationRequested).toBe(false);

    registry.finish(
      job,
      { state: 'completed', translationId: 'saved', historySaved: true },
      success(undefined),
    );

    expect(await job.result).toEqual(success(undefined));
    expect(registry.get(identity, origin)).toBeUndefined();

    expect(registry.summary(identity, origin)).toEqual({
      state: 'completed',
      translationId: 'saved',
      historySaved: true,
    });
  });

  test('expires terminal summaries after two minutes and bounds them to 500', () => {
    let now = 1;
    const registry = new TranslationRequestRegistry(() => now);

    for (let index = 0; index < 501; index++) {
      const job = registry.create(
        { ...identity, requestId: `request-${index}` },
        origin,
      );

      registry.finish(job, { state: 'cancelled' }, success(undefined));
    }

    expect(
      registry.summary({ ...identity, requestId: 'request-0' }, origin),
    ).toBeUndefined();

    expect(
      registry.summary({ ...identity, requestId: 'request-500' }, origin),
    ).toEqual({ state: 'cancelled' });

    now += 120_000;

    expect(
      registry.summary({ ...identity, requestId: 'request-500' }, origin),
    ).toBeUndefined();
  });
});
