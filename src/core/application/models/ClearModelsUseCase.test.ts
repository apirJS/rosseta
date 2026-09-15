import { describe, expect, test, beforeEach } from 'bun:test';
import { ClearModelsUseCase } from './ClearModelsUseCase';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { StorageError } from '../../../shared/errors';

describe('Application: ClearModelsUseCase', () => {
  let storage: FakeModelStorage;

  beforeEach(() => {
    storage = new FakeModelStorage();
    ProviderRegistry.setModels('google', []);
  });

  test('clears storage and registry for the provider', async () => {
    storage.seedModels('google', [
      { id: 'model-a', name: 'Model A', source: 'fetched' },
      { id: 'model-b', name: 'Model B', source: 'manual' },
    ]);
    ProviderRegistry.setModels('google', [
      { id: 'model-a', name: 'Model A' },
      { id: 'model-b', name: 'Model B' },
    ]);

    const useCase = new ClearModelsUseCase(storage);
    const result = await useCase.execute('google');

    expect(result.success).toBe(true);
    expect(storage.getStoredModels('google')).toHaveLength(0);
    expect(ProviderRegistry.getModelsForProvider('google')).toHaveLength(0);
  });

  test('clearing an empty provider succeeds', async () => {
    const useCase = new ClearModelsUseCase(storage);

    const result = await useCase.execute('google');

    expect(result.success).toBe(true);
  });

  test('returns failure when storage clear fails', async () => {
    const useCase = new ClearModelsUseCase(storage);
    storage.failNextCallWith(StorageError.writeFailed('models:google'));

    const result = await useCase.execute('google');

    expect(result.success).toBe(false);
  });
});
