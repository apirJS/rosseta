import { describe, expect, test, beforeEach } from 'bun:test';
import { LoadModelsUseCase } from './LoadModelsUseCase';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { StorageError } from '../../../shared/errors';

describe('Application: LoadModelsUseCase', () => {
  let storage: FakeModelStorage;

  beforeEach(() => {
    storage = new FakeModelStorage();
    ProviderRegistry.setModels('google', []);
    ProviderRegistry.setModels('groq', []);
  });

  test('loads models from storage into ProviderRegistry', async () => {
    storage.seedModels('google', [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', source: 'fetched' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', source: 'fetched' },
    ]);

    const useCase = new LoadModelsUseCase(storage);
    const result = await useCase.execute('google');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].source).toBe('fetched');
    }

    const models = ProviderRegistry.getModelsForProvider('google');
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe('gemini-2.5-flash');
  });

  test('sets empty list when no models stored', async () => {
    const useCase = new LoadModelsUseCase(storage);
    const result = await useCase.execute('google');

    expect(result.success).toBe(true);
    expect(ProviderRegistry.getModelsForProvider('google')).toHaveLength(0);
  });

  test('executeAll loads every provider and returns a map', async () => {
    storage.seedModels('google', [
      { id: 'g-model', name: 'G Model', source: 'fetched' },
    ]);
    storage.seedModels('groq', [
      { id: 'q-model', name: 'Q Model', source: 'manual' },
    ]);

    const useCase = new LoadModelsUseCase(storage);
    const result = await useCase.executeAll();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data['google']).toHaveLength(1);
      expect(result.data['groq']).toHaveLength(1);
    }
  });

  test('executeAll returns models for providers not yet in the registry', async () => {
    storage.seedModels('custom-abc-123', [
      { id: 'local-model', name: 'Local Model', source: 'fetched' },
    ]);

    const useCase = new LoadModelsUseCase(storage);
    const result = await useCase.executeAll();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data['custom-abc-123']).toHaveLength(1);
      expect(result.data['custom-abc-123'][0].id).toBe('local-model');
    }
  });

  test('executeAll fails when any provider read fails', async () => {
    const useCase = new LoadModelsUseCase(storage);
    storage.failNextCallWith(StorageError.readFailed('models:google'));

    const result = await useCase.executeAll();

    expect(result.success).toBe(false);
  });
});
