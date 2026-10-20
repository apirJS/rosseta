import { resetBrowserMock, seedStore } from '../../../../../tests/browser-mock';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { BrowserTranslationCapabilityStorage } from './BrowserTranslationCapabilityStorage';
import { migrateLegacyStructuredOutputExemption } from './legacy-structured-output-migration';
import { TranslationCapabilityState } from '../../translation/compatibility/TranslationCapabilityState';
import { migrateLegacyCapabilities } from '../../translation/compatibility/translation-capability-migration';
import { FakeTranslationCapabilityStorage } from '../../../../../tests/fakes/FakeTranslationCapabilityStorage';

const local = browser.storage.local as unknown as {
  set: ReturnType<typeof mock>;
};

const options = {
  identity: 'digest',
  modelKey: 'provider:namespace:model:version',
  unambiguous: true,
  factKey: 'structured',
  scope: 'model',
};

async function legacyEntries(): Promise<unknown> {
  return (await browser.storage.local.get('structuredOutputExemptModels'))
    .structuredOutputExemptModels;
}

describe('Adapter: legacy structured output capability migration', () => {
  beforeEach(resetBrowserMock);

  test('a provider refresh prevents old unbound records and legacy exclusions from returning', async () => {
    seedStore({
      structuredOutputExemptModels: [options.modelKey, 'unrelated:model'],
    });

    const storage = new BrowserTranslationCapabilityStorage();

    await storage.merge(options.identity, 0, {
      'feature.structured': {
        support: 'unsupported',
        source: 'explicit-provider',
        observedAt: Date.now(),
        scope: 'model',
      },
    });

    await storage.resetNamespace('provider');

    const state = new TranslationCapabilityState(
      options.identity,
      'schema',
      storage,
      {
        namespace: 'provider',
        refreshAfterMs: 7 * 24 * 60 * 60 * 1000,
      },
    );

    await state.load(options.modelKey, true);
    expect(state.support('structured-stream')).toBe('unknown');

    const loaded = await storage.read(options.identity);

    expect(loaded.success && loaded.data?.legacyCleared).toBe(true);
    expect(loaded.success && loaded.data?.namespaceGeneration).toBe(1);
    expect(await legacyEntries()).toEqual(['unrelated:model']);
  });

  test('weekly expiry prevents a retained legacy source entry from undoing refresh', async () => {
    const week = 7 * 24 * 60 * 60 * 1000;

    seedStore({
      structuredOutputExemptModels: [options.modelKey],
      translationCapabilitiesV1: {
        version: 1,
        namespaces: {},
        records: {
          [options.identity]: {
            identity: options.identity,
            namespace: 'provider',
            namespaceGeneration: 0,
            generation: 0,
            refreshedAt: Date.now() - week,
            legacyCleared: false,
            facts: {
              'feature.structured': {
                support: 'unsupported',
                source: 'legacy-policy',
                observedAt: 0,
                scope: 'model',
              },
            },
          },
        },
      },
    });

    const state = new TranslationCapabilityState(
      options.identity,
      'schema',
      new BrowserTranslationCapabilityStorage(),
      {
        namespace: 'provider',
        refreshAfterMs: week,
      },
    );

    await state.load(options.modelKey, true);
    expect(state.support('structured-stream')).toBe('unknown');
    expect(await legacyEntries()).toEqual([]);
  });

  test('matches a whole model key with embedded colons and removes only the migrated entry', async () => {
    seedStore({
      structuredOutputExemptModels: [options.modelKey, 'custom:other:model'],
    });

    const storage = new BrowserTranslationCapabilityStorage();

    const migrated = await migrateLegacyStructuredOutputExemption(
      storage,
      options,
    );

    expect(migrated.success).toBe(true);
    if (migrated.success)
      expect(migrated.data?.facts.structured).toEqual({
        support: 'unsupported',
        source: 'legacy-policy',
        observedAt: 0,
        scope: 'model',
      });
    expect(await legacyEntries()).toEqual(['custom:other:model']);

    const restored = await new BrowserTranslationCapabilityStorage().read(
      options.identity,
    );

    expect(restored.success && restored.data?.facts.structured?.support).toBe(
      'unsupported',
    );
  });

  test('browser storage statically wires legacy migration into capability selection', async () => {
    seedStore({
      structuredOutputExemptModels: [options.modelKey, 'unrelated:model'],
    });

    const storage = new BrowserTranslationCapabilityStorage();

    const state = new TranslationCapabilityState(
      options.identity,
      'schema-version',
      storage,
    );

    await state.load(options.modelKey, true);
    expect(state.support('structured-stream')).toBe('unsupported');
    expect(state.support('structured-buffered')).toBe('unsupported');
    expect(state.support('plain-stream')).toBe('unknown');
    expect(state.support('plain-buffered')).toBe('unknown');
    expect(await legacyEntries()).toEqual(['unrelated:model']);

    const restored = await new BrowserTranslationCapabilityStorage().read(
      options.identity,
    );

    expect(
      restored.success && restored.data?.facts['feature.structured']?.source,
    ).toBe('legacy-policy');
  });

  test('unregistered native or fake storage reads its own facts without invoking browser migration', async () => {
    seedStore({ structuredOutputExemptModels: [options.modelKey] });

    const storage = new FakeTranslationCapabilityStorage();

    expect(await migrateLegacyCapabilities(storage, options)).toEqual({
      success: true,
      data: null,
    });

    expect(await legacyEntries()).toEqual([options.modelKey]);
    expect(local.set).not.toHaveBeenCalled();
  });

  test('registered migration respects a reset after storage and state are reconstructed', async () => {
    seedStore({ structuredOutputExemptModels: [options.modelKey] });

    expect(
      (await new BrowserTranslationCapabilityStorage().reset(options.identity))
        .success,
    ).toBe(true);

    const state = new TranslationCapabilityState(
      options.identity,
      'schema-version',
      new BrowserTranslationCapabilityStorage(),
    );

    await state.load(options.modelKey, true);
    expect(state.support('structured-stream')).toBe('unknown');
    expect(await legacyEntries()).toEqual([]);
  });

  test('retains ambiguous custom-provider exclusions without applying them', async () => {
    seedStore({ structuredOutputExemptModels: [options.modelKey] });

    const migrated = await migrateLegacyStructuredOutputExemption(
      new BrowserTranslationCapabilityStorage(),
      { ...options, unambiguous: false },
    );

    expect(migrated).toEqual({ success: true, data: null });
    expect(await legacyEntries()).toEqual([options.modelKey]);
    expect(local.set).not.toHaveBeenCalled();
  });

  test('failed capability persistence retains the exact legacy source entry', async () => {
    seedStore({ structuredOutputExemptModels: [options.modelKey] });
    local.set.mockRejectedValueOnce(new Error('quota'));

    const storage = new BrowserTranslationCapabilityStorage();

    const migrated = await migrateLegacyStructuredOutputExemption(
      storage,
      options,
    );

    expect(migrated.success).toBe(false);
    expect(await legacyEntries()).toEqual([options.modelKey]);

    const session = await storage.read(options.identity);

    expect(session.success && session.data?.facts.structured?.support).toBe(
      'unsupported',
    );
  });

  test('a persisted reset marker prevents legacy reimport after a restart', async () => {
    seedStore({
      structuredOutputExemptModels: [options.modelKey, 'ambiguous:other'],
    });

    await new BrowserTranslationCapabilityStorage().reset(options.identity);

    const migrated = await migrateLegacyStructuredOutputExemption(
      new BrowserTranslationCapabilityStorage(),
      options,
    );

    expect(migrated.success && migrated.data).toEqual({
      identity: options.identity,
      generation: 1,
      facts: {},
      legacyCleared: true,
    });

    expect(await legacyEntries()).toEqual(['ambiguous:other']);
  });

  test('migration cannot overwrite a newer explicit success', async () => {
    seedStore({ structuredOutputExemptModels: [options.modelKey] });

    const storage = new BrowserTranslationCapabilityStorage();

    await storage.merge(options.identity, 0, {
      structured: {
        support: 'supported',
        source: 'normal-success',
        observedAt: 100,
        scope: 'model',
      },
    });

    const migrated = await migrateLegacyStructuredOutputExemption(
      storage,
      options,
    );

    expect(migrated.success && migrated.data?.facts.structured?.support).toBe(
      'supported',
    );

    expect(await legacyEntries()).toEqual([]);
  });

  test('concurrent migrations preserve unrelated legacy entries and observations', async () => {
    const other = {
      ...options,
      identity: 'digest-other',
      modelKey: 'other:model',
    };

    seedStore({
      structuredOutputExemptModels: [
        options.modelKey,
        other.modelKey,
        'ambiguous:custom',
      ],
    });

    const storage = new BrowserTranslationCapabilityStorage();

    const results = await Promise.all([
      migrateLegacyStructuredOutputExemption(storage, options),
      migrateLegacyStructuredOutputExemption(storage, other),
    ]);

    expect(results.every((result) => result.success)).toBe(true);
    expect(await legacyEntries()).toEqual(['ambiguous:custom']);

    const first = await storage.read(options.identity);
    const second = await storage.read(other.identity);

    expect(first.success && first.data?.facts.structured?.support).toBe(
      'unsupported',
    );

    expect(second.success && second.data?.facts.structured?.support).toBe(
      'unsupported',
    );
  });

  test('malformed legacy entries cannot delete unrelated valid exclusions', async () => {
    seedStore({
      structuredOutputExemptModels: [null, options.modelKey, 'retained:model'],
    });

    const migrated = await migrateLegacyStructuredOutputExemption(
      new BrowserTranslationCapabilityStorage(),
      options,
    );

    expect(migrated.success).toBe(true);
    expect(await legacyEntries()).toEqual(['retained:model']);
  });
});
