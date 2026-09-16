import { describe, expect, test, beforeEach } from 'bun:test';
import { AddCustomModelUseCase } from './AddCustomModelUseCase';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { StorageError } from '../../../shared/errors';

describe('Application: AddCustomModelUseCase', () => {
  let storage: FakeModelStorage;

  beforeEach(() => {
    storage = new FakeModelStorage();
    ProviderRegistry.setModels('google', []);
    ProviderRegistry.setModels('groq', []);
  });

  test('adds a model to empty provider as manual', async () => {
    const useCase = new AddCustomModelUseCase(storage);

    const result = await useCase.execute(
      'google',
      'gemini-2.5-flash',
      'Gemini 2.5 Flash',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('gemini-2.5-flash');
      expect(result.data[0].source).toBe('manual');
    }

    const models = ProviderRegistry.getModelsForProvider('google');
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('gemini-2.5-flash');
  });

  test('does not add duplicate model IDs', async () => {
    const useCase = new AddCustomModelUseCase(storage);

    await useCase.execute('google', 'gemini-2.5-flash');
    const result = await useCase.execute('google', 'gemini-2.5-flash');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
  });

  test('uses model ID as name when no name provided', async () => {
    const useCase = new AddCustomModelUseCase(storage);

    const result = await useCase.execute('groq', 'custom-model');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].name).toBe('custom-model');
    }
  });

  test('appends to existing models', async () => {
    storage.seedModels('google', [
      { id: 'model-a', name: 'Model A', source: 'fetched' },
    ]);

    const useCase = new AddCustomModelUseCase(storage);
    const result = await useCase.execute('google', 'model-b', 'Model B');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  test('returns failure when storage read fails', async () => {
    storage.failNextCallWith(
      StorageError.readFailed('models:google'),
    );
    const useCase = new AddCustomModelUseCase(storage);

    const result = await useCase.execute('google', 'model-x');

    expect(result.success).toBe(false);
  });
});
