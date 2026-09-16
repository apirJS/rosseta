import { describe, expect, test, beforeEach } from 'bun:test';
import { RemoveCustomModelUseCase } from './RemoveCustomModelUseCase';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { StorageError } from '../../../shared/errors';

describe('Application: RemoveCustomModelUseCase', () => {
  let storage: FakeModelStorage;

  beforeEach(() => {
    storage = new FakeModelStorage();
    ProviderRegistry.setModels('google', []);
  });

  test('removes a model by ID and updates the registry', async () => {
    storage.seedModels('google', [
      { id: 'model-a', name: 'Model A', source: 'manual' },
      { id: 'model-b', name: 'Model B', source: 'fetched' },
    ]);
    ProviderRegistry.setModels('google', [
      { id: 'model-a', name: 'Model A' },
      { id: 'model-b', name: 'Model B' },
    ]);

    const useCase = new RemoveCustomModelUseCase(storage);
    const result = await useCase.execute('google', 'model-a');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('model-b');
    }

    const models = ProviderRegistry.getModelsForProvider('google');
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('model-b');
  });

  test('removing non-existent ID is a no-op', async () => {
    storage.seedModels('google', [
      { id: 'model-a', name: 'Model A', source: 'manual' },
    ]);

    const useCase = new RemoveCustomModelUseCase(storage);
    const result = await useCase.execute('google', 'nonexistent');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
  });

  test('returns failure when storage write fails', async () => {
    const useCase = new RemoveCustomModelUseCase(storage);
    storage.failNextCallWith(StorageError.writeFailed('models:google'));

    const result = await useCase.execute('google', 'model-a');

    expect(result.success).toBe(false);
  });
});
