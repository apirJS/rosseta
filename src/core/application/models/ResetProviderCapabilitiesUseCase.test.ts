import { describe, expect, test } from 'bun:test';
import { ResetProviderCapabilitiesUseCase } from './ResetProviderCapabilitiesUseCase';
import { FakeTranslationCapabilityStorage } from '../../../../tests/fakes/FakeTranslationCapabilityStorage';
import { StorageError } from '../../../shared/errors';

describe('Application: ResetProviderCapabilitiesUseCase', () => {
  test('clears every model in the namespace and preserves other providers', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const fact = { support: 'unsupported' as const, source: 'explicit-provider', observedAt: Date.now(), scope: 'model' };
    for (const [identity, namespace] of [['first', 'provider'], ['manual', 'provider'], ['other', 'another']]) {
      storage.records.set(identity, {
        identity, namespace, namespaceGeneration: 0, refreshedAt: Date.now(),
        generation: 0, facts: { capability: fact }, legacyCleared: false,
      });
    }

    expect(await new ResetProviderCapabilitiesUseCase(storage).execute('provider')).toEqual({ success: true, data: undefined });
    expect(storage.records.get('first')?.facts).toEqual({});
    expect(storage.records.get('manual')?.facts).toEqual({});
    expect(storage.records.get('first')?.legacyCleared).toBe(true);
    expect(storage.records.get('other')?.facts.capability).toEqual(fact);
  });

  test('returns a failed refresh without claiming success', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const error = StorageError.writeFailed('translationCapabilitiesV1');
    storage.failWith(error);
    expect(await new ResetProviderCapabilitiesUseCase(storage).execute('provider')).toEqual({ success: false, error });
  });
});
