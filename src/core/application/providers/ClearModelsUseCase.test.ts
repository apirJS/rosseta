import { describe, expect, test, beforeEach } from 'bun:test';
import { ClearModelsUseCase } from './ClearModelsUseCase';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { StorageError } from '../../../shared/errors';

describe('Application: ClearModelsUseCase', () => {
  let storage: FakeModelStorage;

  beforeEach(() => {
    storage = new FakeModelStorage();
  });

  test('clears persisted models for the provider', async () => {
    storage.seedModels('google', [
      { id: 'model-a', name: 'Model A', source: 'fetched' },
      { id: 'model-b', name: 'Model B', source: 'manual' },
    ]);

    const useCase = new ClearModelsUseCase(storage);
    const result = await useCase.execute('google');

    expect(result.success).toBe(true);
    expect(storage.getStoredModels('google')).toHaveLength(0);
    expect(storage.getStoredModels('google')).toHaveLength(0);
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
