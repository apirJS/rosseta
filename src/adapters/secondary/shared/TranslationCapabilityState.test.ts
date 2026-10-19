import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { FakeTranslationCapabilityStorage } from '../../../../tests/fakes/FakeTranslationCapabilityStorage';
import { StorageError } from '../../../shared/errors';
import { TranslationCapabilityState } from './TranslationCapabilityState';
import { GENERATION_MODES } from './ITranslationGenerationTransport';

describe('Adapter: TranslationCapabilityState', () => {
  afterEach(() => mock.restore());

  test('fresh durable evidence outranks an older session cache after a failed write', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const first = new TranslationCapabilityState('model', 'schema', storage);
    await first.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    await first.rejected('structured-stream', 'structured', true);
    await storage.merge('model', 0, { 'feature.structured': { support: 'supported', observedAt: Date.now() + 10, source: 'explicit-provider', scope: 'model' } });
    const next = new TranslationCapabilityState('model', 'schema', storage);
    await next.load();
    expect(next.support('structured-stream')).toBe('unknown');
  });

  test('session facts survive storage failure without repeating unsupported modes', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const first = new TranslationCapabilityState('model', 'schema', storage);
    await first.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    await first.rejected('structured-stream', 'structured', true);
    const next = new TranslationCapabilityState('model', 'schema', storage);
    await next.load();
    expect(next.support('structured-stream')).toBe('unsupported');
    expect(next.support('structured-buffered')).toBe('unsupported');
    expect(next.support('plain-stream')).toBe('unknown');
  });

  test('reset generation discards stale session facts from a failed write', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const first = new TranslationCapabilityState('model', 'schema', storage);
    await first.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    await first.rejected('structured-stream', 'structured', true);
    await storage.reset('model');
    const next = new TranslationCapabilityState('model', 'schema', storage);
    await next.load();
    expect(next.support('structured-stream')).toBe('unknown');
  });

  test('a pre-reset request retains local fallback evidence but never learns into the reset generation', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const merge = spyOn(storage, 'merge');
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    await storage.reset('model');
    await state.rejected('structured-stream', 'structured', true);
    expect(state.support('structured-stream')).toBe('unsupported');
    expect(storage.records.get('model')).toEqual({ identity: 'model', generation: 1, legacyCleared: true, facts: {} });
    const calls = merge.mock.calls.length;
    await state.accepted('plain-stream', false);
    await state.rejected('plain-stream', 'stream', true);
    await state.accepted('plain-buffered', false);
    await state.declareModes(['plain-buffered']);
    expect(merge).toHaveBeenCalledTimes(calls);
    expect(state.support('plain-stream')).toBe('unsupported');
    expect(state.support('plain-buffered')).toBe('supported');
    expect(storage.records.get('model')?.facts).toEqual({});
  });

  test('a stale request removes its failed-write cache without recaching later fallback observations', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    await state.rejected('structured-stream', 'structured', true);
    await storage.reset('model');
    await state.rejected('plain-stream', 'stream', true);
    await state.accepted('plain-buffered', false);
    storage.failWith(StorageError.readFailed('fixture'));
    const next = new TranslationCapabilityState('model', 'schema', storage);
    await next.load();
    expect(next.support('structured-stream')).toBe('unknown');
    expect(next.support('plain-stream')).toBe('unknown');
    expect(next.support('plain-buffered')).toBe('unknown');
    expect(storage.records.get('model')?.facts).toEqual({});
  });

  test('cleaning an old request preserves a newer generation failed-write cache during a read outage', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const old = new TranslationCapabilityState('model', 'schema', storage);
    await old.load();
    await storage.reset('model');
    const fresh = new TranslationCapabilityState('model', 'schema', storage);
    await fresh.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    await fresh.rejected('plain-stream', 'stream', true);
    await old.rejected('structured-stream', 'structured', true);
    await old.accepted('plain-buffered', false);
    storage.failWith(StorageError.readFailed('fixture'));
    const next = new TranslationCapabilityState('model', 'schema', storage);
    await next.load();
    expect(next.support('plain-stream')).toBe('unsupported');
    expect(next.support('structured-stream')).toBe('unsupported');
    expect(next.support('structured-buffered')).toBe('unknown');
    expect(next.support('plain-buffered')).toBe('unknown');
    expect(storage.records.get('model')?.generation).toBe(1);
    expect(storage.records.get('model')?.facts['feature.structured']?.support).toBe('unknown');
  });

  test('a failed stale merge cannot rejoin the reset generation on a later successful merge', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    await storage.reset('model');
    storage.failWith(StorageError.readFailed('fixture'));
    await state.rejected('structured-stream', 'structured', true);
    await state.accepted('plain-stream', false);
    await state.accepted('plain-buffered', false);
    expect(storage.records.get('model')).toEqual({ identity: 'model', generation: 1, legacyCleared: true, facts: {} });
  });

  test('a failed rejection write is retried alongside a later successful fallback observation', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    await state.rejected('structured-stream', 'structured', true);
    await state.accepted('plain-stream', false);
    expect(storage.records.get('model')?.facts['feature.structured']?.support).toBe('unsupported');
    const next = new TranslationCapabilityState('model', 'schema', storage);
    await next.load();
    expect(next.support('structured-stream')).toBe('unsupported');
    expect(next.support('structured-buffered')).toBe('unsupported');
    expect(next.support('plain-stream')).toBe('supported');
  });

  test('failed observations loaded from session are eventually persisted without relying on a browser journal', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const old = new TranslationCapabilityState('model', 'schema', storage);
    await old.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    await old.rejected('structured-stream', 'structured', true);
    const next = new TranslationCapabilityState('model', 'schema', storage);
    await next.load('provider:model', true);
    expect(next.support('structured-stream')).toBe('unsupported');
    await next.accepted('plain-stream', false);
    expect(storage.records.get('model')?.facts['feature.structured']?.support).toBe('unsupported');
    expect(storage.records.get('model')?.facts['mode.plain-stream']?.support).toBe('supported');
  });

  test('retrying failed observations preserves newer durable evidence', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    await state.rejected('structured-stream', 'structured', true);
    await storage.merge('model', 0, { 'feature.structured': { support: 'supported', observedAt: Date.now() + 100, source: 'explicit-provider', scope: 'model' } });
    await state.accepted('plain-stream', false);
    expect(storage.records.get('model')?.facts['feature.structured']?.support).toBe('supported');
  });

  test('a failed reset keeps the active request eligible to persist real observations', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    storage.failWith(StorageError.writeFailed('fixture'));
    expect((await storage.reset('model')).success).toBe(false);
    await state.rejected('structured-stream', 'structured', true);
    await state.accepted('plain-stream', false);
    expect(storage.records.get('model')?.generation).toBe(0);
    expect(storage.records.get('model')?.facts['feature.structured']?.support).toBe('unsupported');
    expect(storage.records.get('model')?.facts['mode.plain-stream']?.support).toBe('supported');
  });

  test('a validated no-text/refusal envelope establishes mode support without claiming image understanding', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    await state.accepted('structured-stream', true, false);
    const record = storage.records.get('model')!;
    expect(record.facts['feature.structured'].support).toBe('supported');
    expect(record.facts['feature.stream'].support).toBe('supported');
    expect(record.facts['feature.image'].support).toBe('unknown');
  });

  test('schema-specific combination facts do not discard general limitations after schema change', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const first = new TranslationCapabilityState('model', 'schema-one', storage);
    await first.load();
    await first.rejected('structured-stream', 'combination');
    const second = new TranslationCapabilityState('model', 'schema-two', storage);
    await second.load();
    expect(second.support('structured-stream')).toBe('unknown');
    await second.rejected('structured-stream', 'stream', true);
    const third = new TranslationCapabilityState('model', 'schema-three', storage);
    await third.load();
    expect(third.support('structured-stream')).toBe('unsupported');
    expect(third.support('plain-stream')).toBe('unsupported');
  });

  test('current transport constraints are local and never become durable model evidence', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    const merge = spyOn(storage, 'merge');
    await state.declareModes(['plain-stream', 'plain-buffered']);
    expect(state.support('structured-stream')).toBe('unsupported');
    expect(state.support('structured-buffered')).toBe('unsupported');
    expect(state.support('plain-stream')).toBe('unknown');
    expect(merge).not.toHaveBeenCalled();
    expect(Object.values(storage.records.get('model')!.facts).some(fact => fact.source === 'declared-transport')).toBe(false);
  });

  test('a newer transport can allow modes excluded by an older Puter declaration', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    await storage.merge('model', 0, {
      'mode.structured-stream:transport': { support: 'unsupported', source: 'declared-transport', observedAt: 1, scope: 'transport' },
      'mode.structured-buffered:transport': { support: 'unsupported', source: 'declared-transport', observedAt: 1, scope: 'transport' },
    });
    const previous = new TranslationCapabilityState('model', 'schema', storage);
    await previous.load();
    await previous.declareModes(['plain-stream', 'plain-buffered']);
    expect(previous.support('structured-stream')).toBe('unsupported');

    const upgraded = new TranslationCapabilityState('model', 'schema', storage);
    await upgraded.load();
    await upgraded.declareModes(GENERATION_MODES);
    expect(upgraded.support('structured-stream')).toBe('unknown');
    expect(upgraded.support('structured-buffered')).toBe('unknown');
    await upgraded.accepted('structured-stream', true);
    expect(upgraded.support('structured-stream')).toBe('supported');
  });

  test('an unrestricted SDK transport ignores legacy persisted transport exclusions', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    await storage.merge('model', 0, Object.fromEntries(GENERATION_MODES.map(mode => [
      `mode.${mode}:transport`,
      { support: 'unsupported' as const, source: 'declared-transport', observedAt: 1, scope: 'transport' },
    ])));
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    // SDK transports omit supportedModes when they impose no local restriction.
    for (const mode of GENERATION_MODES) expect(state.support(mode)).toBe('unknown');
  });

  test('transport expansion preserves observed provider and schema-specific limitations', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const state = new TranslationCapabilityState('model', 'schema', storage);
    await state.load();
    await state.declareModes(['plain-stream', 'plain-buffered']);
    await state.rejected('structured-stream', 'combination');
    await state.rejected('plain-stream', 'stream', true);
    await state.declareModes(GENERATION_MODES);
    expect(state.support('structured-stream')).toBe('unsupported');
    expect(state.support('plain-stream')).toBe('unsupported');
    expect(state.support('structured-buffered')).toBe('unknown');
    expect(state.support('plain-buffered')).toBe('unknown');
  });
});
