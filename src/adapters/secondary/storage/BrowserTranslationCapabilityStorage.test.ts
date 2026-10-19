import { resetBrowserMock, seedStore } from '../../../../tests/browser-mock';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as browser from 'webextension-polyfill';
import {
  BrowserTranslationCapabilityStorage,
  TRANSLATION_CAPABILITIES_STORAGE_KEY as KEY,
} from './BrowserTranslationCapabilityStorage';
import { TranslationCapabilityState } from '../shared/TranslationCapabilityState';
import type {
  TranslationCapabilityFact,
  TranslationCapabilityRecord,
} from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import { ErrorCode } from '../../../shared/errors';

const local = browser.storage.local as unknown as {
  get: ReturnType<typeof mock>;
  set: ReturnType<typeof mock>;
  remove: ReturnType<typeof mock>;
};
const observed = (
  support: TranslationCapabilityFact['support'],
  observedAt = 10,
  source = 'normal-success',
): TranslationCapabilityFact => ({
  support,
  observedAt,
  source,
  scope: 'model',
});

async function record(
  storage: BrowserTranslationCapabilityStorage,
  identity = 'model',
): Promise<TranslationCapabilityRecord | null> {
  const result = await storage.read(identity);
  if (!result.success) throw result.error;
  return result.data;
}

describe('Adapter: BrowserTranslationCapabilityStorage', () => {
  beforeEach(resetBrowserMock);

  test('starts unknown without deleting the legacy exclusions', async () => {
    seedStore({ structuredOutputExemptModels: ['provider:model'] });
    expect(await record(new BrowserTranslationCapabilityStorage())).toBeNull();
    expect(local.remove).not.toHaveBeenCalled();
    expect(
      (await browser.storage.local.get('structuredOutputExemptModels'))
        .structuredOutputExemptModels,
    ).toEqual(['provider:model']);
  });

  test('persists positive and negative facts and restores them in a new instance', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    expect(
      (
        await storage.merge('model', 0, {
          streaming: observed('unsupported'),
          buffered: observed('supported'),
        })
      ).success,
    ).toBe(true);
    expect(await record(new BrowserTranslationCapabilityStorage())).toEqual({
      identity: 'model',
      generation: 0,
      legacyCleared: false,
      facts: {
        streaming: observed('unsupported'),
        buffered: observed('supported'),
      },
    });
  });

  test('serializes merges across instances without losing another model or mode', async () => {
    const first = new BrowserTranslationCapabilityStorage();
    const second = new BrowserTranslationCapabilityStorage();
    const results = await Promise.all([
      first.merge('model', 0, { streaming: observed('unsupported') }),
      second.merge('model', 0, { buffered: observed('supported') }),
      first.merge('other', 0, { vision: observed('supported') }),
    ]);
    expect(results.every((result) => result.success)).toBe(true);
    const restored = new BrowserTranslationCapabilityStorage();
    expect(Object.keys((await record(restored))?.facts ?? {})).toEqual([
      'streaming',
      'buffered',
    ]);
    expect((await record(restored, 'other'))?.facts.vision?.support).toBe(
      'supported',
    );
  });

  test('defaults and metadata refreshes cannot overwrite learned limitations', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    await storage.merge('model', 0, {
      streaming: observed('unsupported', 1, 'explicit-rejection'),
    });
    await storage.merge('model', 0, {
      streaming: observed('unknown', 999, 'default'),
    });
    await storage.merge('model', 0, {
      streaming: observed('supported', 1000, 'provider-metadata'),
    });
    expect((await record(storage))?.facts.streaming).toEqual(
      observed('unsupported', 1, 'explicit-rejection'),
    );
  });

  test('latest explicit observation wins while older evidence is ignored', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    await storage.merge('model', 0, { feature: observed('supported', 20) });
    await storage.merge('model', 0, {
      feature: observed('unsupported', 10, 'explicit-rejection'),
    });
    expect((await record(storage))?.facts.feature?.support).toBe('supported');
    await storage.merge('model', 0, {
      feature: observed('unsupported', 21, 'explicit-rejection'),
    });
    expect((await record(storage))?.facts.feature?.support).toBe('unsupported');
  });

  test('stores scoped facts independently and returns defensive copies', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    const fact = observed('unsupported');
    await storage.merge('model', 0, {
      'schema:a': { ...fact, scope: 'schema:a' },
      'schema:b': { ...fact, support: 'supported', scope: 'schema:b' },
    });
    const first = await record(storage);
    if (first?.facts['schema:a']) first.facts['schema:a'].support = 'supported';
    expect((await record(storage))?.facts['schema:a']?.support).toBe(
      'unsupported',
    );
    expect((await record(storage))?.facts['schema:b']?.support).toBe(
      'supported',
    );
  });

  test('retains failed writes in session and retries them with a later merge', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    local.set.mockRejectedValueOnce(new Error('quota'));
    const failed = await storage.merge('model', 0, {
      streaming: observed('unsupported'),
    });
    expect(failed.success).toBe(false);
    if (!failed.success)
      expect(failed.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    expect((await record(storage))?.facts.streaming?.support).toBe(
      'unsupported',
    );
    expect(await record(new BrowserTranslationCapabilityStorage())).toBeNull();
    await storage.merge('other', 0, { buffered: observed('supported') });
    const restored = new BrowserTranslationCapabilityStorage();
    expect((await record(restored))?.facts.streaming?.support).toBe(
      'unsupported',
    );
    expect((await record(restored, 'other'))?.facts.buffered?.support).toBe(
      'supported',
    );
  });

  test('a read outage uses session facts without rewriting unrelated durable records', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    await storage.merge('model', 0, { streaming: observed('supported') });
    local.get.mockRejectedValueOnce(new Error('offline'));
    expect((await record(storage))?.facts.streaming?.support).toBe('supported');
    local.get.mockRejectedValueOnce(new Error('offline'));
    const failed = await storage.merge('model', 0, {
      structured: observed('unsupported'),
    });
    expect(failed.success).toBe(false);
    expect(local.set).toHaveBeenCalledTimes(1);
    expect((await record(storage))?.facts.structured?.support).toBe(
      'unsupported',
    );
  });

  test('read errors without session state return an expected error', async () => {
    local.get.mockRejectedValueOnce(new Error('offline'));
    const result = await new BrowserTranslationCapabilityStorage().read(
      'model',
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
  });

  test('reset persists a generation tombstone, clears only one scope, and rejects stale writes', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    await storage.merge('model', 0, { streaming: observed('unsupported') });
    await storage.merge('other', 0, { streaming: observed('supported') });
    expect((await storage.reset('model')).success).toBe(true);
    const stale = await storage.merge('model', 0, {
      streaming: observed('unsupported', 999),
    });
    expect(stale.success).toBe(true);
    const restored = new BrowserTranslationCapabilityStorage();
    expect(await record(restored)).toEqual({
      identity: 'model',
      generation: 1,
      facts: {},
      legacyCleared: true,
    });
    expect((await record(restored, 'other'))?.facts.streaming?.support).toBe(
      'supported',
    );
    await restored.merge('model', 1, {
      streaming: observed('supported', 1000),
    });
    expect((await record(restored))?.facts.streaming?.support).toBe(
      'supported',
    );
  });

  test('another instance reset discards failed-write session observations', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    local.set.mockRejectedValueOnce(new Error('quota'));
    await storage.merge('model', 0, { streaming: observed('unsupported') });
    await new BrowserTranslationCapabilityStorage().reset('model');
    expect((await record(storage))?.facts).toEqual({});
    await storage.merge('other', 0, { streaming: observed('supported') });
    expect(
      (await record(new BrowserTranslationCapabilityStorage()))?.facts,
    ).toEqual({});
  });

  test('an old request cannot restore observations after another adapter resets its failed writes', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    local.set.mockRejectedValueOnce(new Error('quota'));
    await state.rejected('structured-stream', 'structured', true);
    await new BrowserTranslationCapabilityStorage().reset('model');
    await state.rejected('plain-stream', 'stream', true);
    await state.accepted('plain-buffered', false);
    expect(state.support('structured-stream')).toBe('unsupported');
    expect(state.support('plain-buffered')).toBe('supported');
    expect(await record(new BrowserTranslationCapabilityStorage())).toEqual({
      identity: 'model',
      generation: 1,
      facts: {},
      legacyCleared: true,
    });
  });

  test('a failed rejection write is durably recovered when the same request finishes through fallback', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    local.set.mockRejectedValueOnce(new Error('quota'));
    await state.rejected('structured-stream', 'structured', true);
    await state.accepted('plain-stream', false);
    const restored = new TranslationCapabilityState(
      'model',
      'schema',
      new BrowserTranslationCapabilityStorage(),
    );
    await restored.load();
    expect(restored.support('structured-stream')).toBe('unsupported');
    expect(restored.support('plain-stream')).toBe('supported');
  });

  test('failed reset leaves previously learned facts and does not claim a reset', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    await storage.merge('model', 0, { streaming: observed('unsupported') });
    local.set.mockRejectedValueOnce(new Error('quota'));
    expect((await storage.reset('model')).success).toBe(false);
    expect((await record(storage))?.generation).toBe(0);
    expect(
      (await record(new BrowserTranslationCapabilityStorage()))?.facts.streaming
        ?.support,
    ).toBe('unsupported');
  });

  test('isolates corrupt records while preserving every valid old record', async () => {
    const valid = {
      identity: 'old',
      generation: 0,
      legacyCleared: false,
      facts: { feature: observed('unsupported', 0) },
    };
    seedStore({
      [KEY]: { version: 1, records: { old: valid, broken: { invalid: true } } },
    });
    const storage = new BrowserTranslationCapabilityStorage();
    expect(await record(storage, 'broken')).toBeNull();
    await storage.merge('new', 0, { feature: observed('supported') });
    expect(
      await record(new BrowserTranslationCapabilityStorage(), 'old'),
    ).toEqual(valid);
    expect(local.remove).not.toHaveBeenCalled();
  });

  test('does not expire or evict knowledge when a large catalog grows', async () => {
    const records = Object.fromEntries(
      Array.from({ length: 700 }, (_, index) => {
        const identity = `model-${index}`;
        return [
          identity,
          {
            identity,
            generation: 0,
            legacyCleared: false,
            facts: { feature: observed('unsupported', 0) },
          },
        ];
      }),
    );
    seedStore({ [KEY]: { version: 1, records } });
    const storage = new BrowserTranslationCapabilityStorage();
    await storage.merge('newest', 0, { feature: observed('supported') });
    const persisted = (await browser.storage.local.get(KEY))[KEY] as {
      records: Record<string, unknown>;
    };
    expect(Object.keys(persisted.records)).toHaveLength(701);
    expect(
      (await record(new BrowserTranslationCapabilityStorage(), 'model-0'))
        ?.facts.feature?.support,
    ).toBe('unsupported');
  });

  test('preserves valid opaque identities which match object prototype property names', async () => {
    const identity = '__proto__';
    const valid = {
      identity,
      generation: 0,
      legacyCleared: false,
      facts: { feature: observed('unsupported') },
    };
    seedStore({
      [KEY]: { version: 1, records: Object.fromEntries([[identity, valid]]) },
    });
    const storage = new BrowserTranslationCapabilityStorage();
    expect(await record(storage, identity)).toEqual(valid);
    await storage.merge('other', 0, { feature: observed('supported') });
    expect(
      await record(new BrowserTranslationCapabilityStorage(), identity),
    ).toEqual(valid);
  });
});
