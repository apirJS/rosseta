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
import { resetBrowserMock, seedStore } from '../../../../../tests/browser-mock';
import type {
  TranslationCapabilityReadContext,
  TranslationCapabilityRecord,
} from '../../../../core/ports/outbound/ITranslationCapabilityStorage';
import { TranslationCapabilityJournal } from '../../translation/compatibility/TranslationCapabilityJournal';
import {
  BrowserTranslationCapabilityStorage,
  TRANSLATION_CAPABILITIES_STORAGE_KEY as KEY,
} from './BrowserTranslationCapabilityStorage';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const scope = { namespace: 'openai', refreshAfterMs: WEEK };
const otherScope = { namespace: 'custom-other', refreshAfterMs: WEEK };

const local = browser.storage.local as unknown as {
  get: ReturnType<typeof mock>;
  set: ReturnType<typeof mock>;
};

let now = 1_000_000_000;

function fact(support: 'supported' | 'unsupported') {
  return {
    support,
    source: 'explicit-provider',
    observedAt: now,
    scope: 'model',
  };
}

async function read(
  storage: BrowserTranslationCapabilityStorage,
  identity = 'model',
  context: TranslationCapabilityReadContext = scope,
): Promise<TranslationCapabilityRecord> {
  const result = await storage.read(identity, context);

  if (!result.success) throw result.error;
  if (!result.data) throw new Error('Expected a contextual model record');

  return result.data;
}

async function learn(
  storage: BrowserTranslationCapabilityStorage,
  identity = 'model',
  context = scope,
): Promise<TranslationCapabilityRecord> {
  const current = await read(storage, identity, context);

  const merged = await storage.merge(
    identity,
    current.generation,
    {
      'feature.structured': fact('unsupported'),
      'mode.plain-stream': fact('supported'),
    },
    { ...context, namespaceGeneration: current.namespaceGeneration ?? 0 },
  );

  if (!merged.success) throw merged.error;

  return merged.data;
}

describe('Adapter: compatibility automatic and provider refresh', () => {
  beforeEach(() => {
    resetBrowserMock();
    now = 1_000_000_000;
    spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => mock.restore());

  test('expires at exactly seven days and ordinary successful observations do not extend the window', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    const initial = await learn(storage);

    now += 6 * DAY;

    await storage.merge(
      'model',
      initial.generation,
      { 'mode.plain-stream': fact('supported') },
      {
        ...scope,
        namespaceGeneration: 0,
      },
    );

    expect((await read(storage)).refreshedAt).toBe(initial.refreshedAt);
    now = initial.refreshedAt! + WEEK - 1;

    expect((await read(storage)).facts['feature.structured']?.support).toBe(
      'unsupported',
    );

    now++;

    const expired = await read(storage);

    expect(expired.generation).toBe(initial.generation + 1);
    expect(expired.facts).toEqual({});
    expect(expired.legacyCleared).toBe(true);
    expect(expired.refreshedAt).toBe(now);

    expect(
      (await read(new BrowserTranslationCapabilityStorage())).generation,
    ).toBe(expired.generation);
  });

  test('a merge also expires the record atomically and rejects pre-expiry observations', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    const initial = await learn(storage);

    now += WEEK;

    const stale = await storage.merge(
      'model',
      initial.generation,
      { 'feature.stream': fact('unsupported') },
      {
        ...scope,
        namespaceGeneration: 0,
      },
    );

    expect(stale.success && stale.data.generation).toBe(initial.generation + 1);
    expect(stale.success && stale.data.facts).toEqual({});

    expect(
      (await read(new BrowserTranslationCapabilityStorage())).facts,
    ).toEqual({});
  });

  test('concurrent readers refresh one expired generation only once across storage instances', async () => {
    const initial = await learn(new BrowserTranslationCapabilityStorage());

    now += WEEK;

    const writes = local.set.mock.calls.length;

    const [first, second] = await Promise.all([
      read(new BrowserTranslationCapabilityStorage()),
      read(new BrowserTranslationCapabilityStorage()),
    ]);

    expect(first).toEqual(second);
    expect(first.generation).toBe(initial.generation + 1);
    expect(local.set.mock.calls.length - writes).toBe(1);
  });

  test('expiry is per model and never clears another model before its own deadline', async () => {
    const storage = new BrowserTranslationCapabilityStorage();

    await learn(storage, 'first');
    now += DAY;
    await learn(storage, 'second');
    now += 6 * DAY;
    expect((await read(storage, 'first')).facts).toEqual({});

    expect(
      (await read(storage, 'second')).facts['feature.structured']?.support,
    ).toBe('unsupported');
  });

  test('failed expiry persistence keeps an empty session tombstone and retries on a later write', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    const initial = await learn(storage);

    now += WEEK;
    local.set.mockRejectedValueOnce(new Error('quota'));

    const refreshed = await read(storage);

    expect(refreshed.generation).toBe(initial.generation + 1);
    expect(refreshed.facts).toEqual({});
    expect((await read(storage)).facts).toEqual({});

    const merged = await storage.merge(
      'model',
      refreshed.generation,
      { 'feature.structured': fact('supported') },
      {
        ...scope,
        namespaceGeneration: 0,
      },
    );

    expect(merged.success).toBe(true);

    const restored = await read(new BrowserTranslationCapabilityStorage());

    expect(restored.generation).toBe(refreshed.generation);
    expect(restored.facts['feature.structured']?.support).toBe('supported');
  });

  test('an outage cannot return expired session facts and its refreshed state can later persist', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    const initial = await learn(storage);

    now += WEEK;
    local.get.mockRejectedValueOnce(new Error('offline'));

    const refreshed = await read(storage);

    expect(refreshed.generation).toBe(initial.generation + 1);
    expect(refreshed.facts).toEqual({});

    const merged = await storage.merge(
      'model',
      refreshed.generation,
      { 'mode.structured-stream:test': fact('supported') },
      {
        ...scope,
        namespaceGeneration: 0,
      },
    );

    expect(merged.success).toBe(true);

    expect(
      (await read(new BrowserTranslationCapabilityStorage())).facts[
        'feature.structured'
      ],
    ).toBeUndefined();
  });

  test('provider refresh clears every tagged scope for that provider and preserves another provider', async () => {
    const storage = new BrowserTranslationCapabilityStorage();

    await learn(storage, 'first');
    await learn(storage, 'second-endpoint-or-model');

    const unrelated = await learn(storage, 'other-model', otherScope);

    now += DAY;
    expect((await storage.resetNamespace(scope.namespace)).success).toBe(true);

    const refreshedRecords = await Promise.all(
      ['first', 'second-endpoint-or-model'].map((identity) =>
        read(new BrowserTranslationCapabilityStorage(), identity),
      ),
    );

    for (const refreshed of refreshedRecords) {
      expect(refreshed.facts).toEqual({});
      expect(refreshed.namespaceGeneration).toBe(1);
      expect(refreshed.legacyCleared).toBe(true);
      expect(refreshed.refreshedAt).toBe(now);
    }

    expect(await read(storage, 'other-model', otherScope)).toEqual(unrelated);
  });

  test('a namespace marker with no records rejects a missing pre-refresh model write', async () => {
    const storage = new BrowserTranslationCapabilityStorage();

    await storage.resetNamespace(scope.namespace);

    const stale = await new BrowserTranslationCapabilityStorage().merge(
      'never-persisted',
      0,
      {
        'feature.structured': fact('unsupported'),
      },
      { ...scope, namespaceGeneration: 0 },
    );

    expect(stale.success && stale.data.facts).toEqual({});
    expect(stale.success && stale.data.namespaceGeneration).toBe(1);

    const current = await read(storage, 'never-persisted');

    const fresh = await storage.merge(
      current.identity,
      current.generation,
      { 'feature.structured': fact('supported') },
      {
        ...scope,
        namespaceGeneration: current.namespaceGeneration!,
      },
    );

    expect(
      fresh.success && fresh.data.facts['feature.structured']?.support,
    ).toBe('supported');
  });

  test('a provider reset discards failed pending writes from another adapter instance', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    const initial = await read(storage);

    local.set.mockRejectedValueOnce(new Error('quota'));

    await storage.merge(
      'model',
      initial.generation,
      { 'feature.structured': fact('unsupported') },
      {
        ...scope,
        namespaceGeneration: 0,
      },
    );

    await new BrowserTranslationCapabilityStorage().resetNamespace(
      scope.namespace,
    );

    const refreshed = await read(storage);

    expect(refreshed.facts).toEqual({});
    expect(refreshed.namespaceGeneration).toBe(1);

    await storage.merge(
      'model',
      initial.generation,
      { 'mode.plain-stream': fact('supported') },
      {
        ...scope,
        namespaceGeneration: 0,
      },
    );

    expect(
      (await read(new BrowserTranslationCapabilityStorage())).facts,
    ).toEqual({});
  });

  test('a confirmed provider reset clears another instance session facts immediately during a read outage', async () => {
    const first = new BrowserTranslationCapabilityStorage();

    await learn(first);

    await new BrowserTranslationCapabilityStorage().resetNamespace(
      scope.namespace,
    );

    local.get.mockRejectedValueOnce(new Error('offline'));

    const refreshed = await read(first);

    expect(refreshed.namespaceGeneration).toBe(1);
    expect(refreshed.facts).toEqual({});
    expect(refreshed.legacyCleared).toBe(true);
  });

  test('provider markers invalidate untagged old records on lazy binding without touching unrelated legacy records', async () => {
    const storage = new BrowserTranslationCapabilityStorage();

    await storage.merge('old-provider-model', 0, {
      'feature.structured': fact('unsupported'),
    });

    await storage.merge('unrelated-old-model', 0, {
      'feature.structured': fact('unsupported'),
    });

    await storage.resetNamespace(scope.namespace);

    const refreshed = await read(
      new BrowserTranslationCapabilityStorage(),
      'old-provider-model',
    );

    expect(refreshed.facts).toEqual({});
    expect(refreshed.legacyCleared).toBe(true);
    expect(refreshed.namespaceGeneration).toBe(1);

    const unrelated = await read(storage, 'unrelated-old-model', otherScope);

    expect(unrelated.facts['feature.structured']?.support).toBe('unsupported');
    expect(unrelated.namespaceGeneration).toBe(0);
  });

  test('failed explicit provider refresh preserves the existing durable epoch and facts', async () => {
    const storage = new BrowserTranslationCapabilityStorage();
    const initial = await learn(storage);

    local.set.mockRejectedValueOnce(new Error('quota'));

    expect(
      (
        await new BrowserTranslationCapabilityStorage().resetNamespace(
          scope.namespace,
        )
      ).success,
    ).toBe(false);

    local.get.mockRejectedValueOnce(new Error('offline'));
    expect(await read(storage)).toEqual(initial);

    expect(await read(new BrowserTranslationCapabilityStorage())).toEqual(
      initial,
    );
  });

  test('a successful empty envelope read replaces confirmed namespace markers after storage is cleared', async () => {
    const first = new BrowserTranslationCapabilityStorage();

    await first.resetNamespace(scope.namespace);
    expect((await read(first)).namespaceGeneration).toBe(1);
    await browser.storage.local.clear();
    await new BrowserTranslationCapabilityStorage().read('unrelated');

    const fresh = await read(new BrowserTranslationCapabilityStorage());

    expect(fresh.namespaceGeneration).toBe(0);
    expect(fresh.generation).toBe(0);
  });

  test('namespace epoch blocks stale learning even when a failed-write model generation equals the new one', async () => {
    const storage = new BrowserTranslationCapabilityStorage();

    local.set.mockRejectedValueOnce(new Error('quota'));
    await read(storage);
    now += WEEK;
    local.set.mockRejectedValueOnce(new Error('quota'));

    const expired = await read(storage);

    expect(expired.generation).toBe(1);

    const journal = new TranslationCapabilityJournal('model', storage, scope);

    await journal.load();
    // This was only session state; simulate another worker refreshing the empty durable namespace.
    seedStore({ [KEY]: { version: 1, records: {}, namespaces: {} } });

    await new BrowserTranslationCapabilityStorage().resetNamespace(
      scope.namespace,
    );

    await journal.record({ 'feature.structured': fact('unsupported') });
    await journal.record({ 'mode.plain-stream': fact('supported') });
    expect(journal.facts['feature.structured']?.support).toBe('unsupported');

    const current = await read(new BrowserTranslationCapabilityStorage());

    expect(current.generation).toBe(1);
    expect(current.namespaceGeneration).toBe(1);
    expect(current.facts).toEqual({});
  });
});
