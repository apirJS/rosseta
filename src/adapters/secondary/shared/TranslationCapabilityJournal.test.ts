import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { FakeTranslationCapabilityStorage } from '../../../../tests/fakes/FakeTranslationCapabilityStorage';
import { StorageError } from '../../../shared/errors';
import { TranslationCapabilityJournal } from './TranslationCapabilityJournal';

const DAY = 86_400_000;
const context = { namespace: 'provider', refreshAfterMs: 7 * DAY };
let now = 1_000_000_000;
const fact = (support: 'supported' | 'unsupported') => ({ support, source: 'explicit-provider', scope: 'model', observedAt: now });

describe('Adapter: TranslationCapabilityJournal refresh epochs', () => {
  beforeEach(() => {
    now = 1_000_000_000;
    spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => mock.restore());

  test('a read outage cannot recover expired failed-write facts from the shared session cache', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const first = new TranslationCapabilityJournal('model', storage, context);
    await first.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    await first.record({ 'feature.structured': fact('unsupported') });
    now += context.refreshAfterMs;
    storage.failWith(StorageError.readFailed('fixture'));
    const refreshed = new TranslationCapabilityJournal('model', storage, context);
    await refreshed.load();
    expect(refreshed.facts).toEqual({});
    await refreshed.record({ 'mode.structured-stream:test': fact('supported') });
    expect(storage.records.get('model')?.generation).toBe(1);
    expect(storage.records.get('model')?.facts['feature.structured']).toBeUndefined();
    expect(storage.records.get('model')?.facts['mode.structured-stream:test']?.support).toBe('supported');
  });

  test('expired cache evidence is ignored even if another instance persisted the same generation later', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const first = new TranslationCapabilityJournal('model', storage, context);
    await first.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    await first.record({ 'feature.structured': fact('unsupported') });
    const current = storage.records.get('model')!;
    // Concurrent recovery may persist a fresh cycle after an earlier write failed.
    storage.records.set('model', { ...current, refreshedAt: now + DAY, facts: {} });
    now += context.refreshAfterMs;
    const next = new TranslationCapabilityJournal('model', storage, context);
    await next.load();
    expect(next.facts['feature.structured']).toBeUndefined();
  });

  test('a stale pre-refresh request cannot overwrite or remove a newer namespace session cache', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const old = new TranslationCapabilityJournal('model', storage, context);
    await old.load();
    await storage.resetNamespace(context.namespace);
    const fresh = new TranslationCapabilityJournal('model', storage, context);
    await fresh.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    await fresh.record({ 'feature.stream': fact('unsupported') });
    await old.record({ 'feature.structured': fact('unsupported') });
    await old.record({ 'mode.plain-stream': fact('supported') });
    storage.failWith(StorageError.readFailed('fixture'));
    const next = new TranslationCapabilityJournal('model', storage, context);
    await next.load();
    expect(next.facts['feature.stream']?.support).toBe('unsupported');
    expect(next.facts['feature.structured']).toBeUndefined();
    expect(next.facts['mode.plain-stream']).toBeUndefined();
    await next.record({ 'mode.plain-buffered': fact('supported') });
    expect(storage.records.get('model')?.namespaceGeneration).toBe(1);
    expect(storage.records.get('model')?.facts['feature.stream']?.support).toBe('unsupported');
  });
});
