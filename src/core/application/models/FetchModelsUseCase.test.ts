import { describe, expect, test, beforeEach } from 'bun:test';
import { FetchModelsUseCase } from './FetchModelsUseCase';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { FakeModelFetchService } from '../../../../tests/fakes/FakeModelFetchService';
import { FakeUserPreferencesStorage } from '../../../../tests/fakes/FakeUserPreferencesStorage';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { UserPreferences } from '../../domain/preferences/UserPreferences';
import { StorageError, NetworkError, AuthError, ErrorCode } from '../../../shared/errors';
import { v4 as uuidv4 } from 'uuid';

describe('Application: FetchModelsUseCase', () => {
  let storage: FakeModelStorage;
  let fetchService: FakeModelFetchService;
  let preferencesStorage: FakeUserPreferencesStorage;

  beforeEach(() => {
    storage = new FakeModelStorage();
    fetchService = new FakeModelFetchService();
    preferencesStorage = new FakeUserPreferencesStorage();
    ProviderRegistry.setModels('google', []);
  });

  function seedPreferences(selectedModels: Record<string, string>) {
    const result = UserPreferences.fromRaw({
      id: uuidv4(),
      theme: 'system',
      targetLanguage: 'en-US',
      selectedModels,
    });
    if (!result.success) throw new Error('bad prefs');
    preferencesStorage.seed(result.data);
  }

  test('fetches models, persists, and updates the registry', async () => {
    fetchService.seedModels('google', [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ]);

    const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].source).toBe('fetched');
    }
    expect(storage.getStoredModels('google')).toHaveLength(2);
    expect(ProviderRegistry.getModelsForProvider('google')).toHaveLength(2);
  });

  test('merges fetched models with manual models, manual wins on ID conflict', async () => {
    storage.seedModels('google', [
      { id: 'shared-model', name: 'My Custom Name', source: 'manual' },
    ]);
    fetchService.seedModels('google', [
      { id: 'shared-model', name: 'API Name' },
      { id: 'new-model', name: 'New Model' },
    ]);

    const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      const shared = result.data.find((m) => m.id === 'shared-model');
      expect(shared?.source).toBe('manual');
      expect(shared?.name).toBe('My Custom Name');
    }
  });

  test('returns failure when the fetch service fails', async () => {
    fetchService.seedError('google', AuthError.invalidApiKey());

    const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
    const result = await useCase.execute('google', 'bad-key');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
    }
    expect(storage.getStoredModels('google')).toHaveLength(0);
  });

  test('returns failure for providers without a fetcher', async () => {
    fetchService.setFetchable([]);

    const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.VALIDATION_INVALID_INPUT);
    }
  });

  test('returns failure when persisting fails', async () => {
    fetchService.seedModels('google', [{ id: 'm1', name: 'M1' }]);
    storage.failNextCallWith(StorageError.writeFailed('models:google'));

    const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });

  test('propagates network error classification', async () => {
    fetchService.seedError(
      'google',
      NetworkError.serverError(503, 'https://api.test'),
    );

    const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NetworkError);
    }
  });

  describe('selected model repair', () => {
    test('repairs a stale selection to the first fetched model when the default is absent', async () => {
      seedPreferences({ google: 'dead-model' });
      fetchService.seedModels('google', [
        { id: 'm1', name: 'Model 1' },
        { id: 'm2', name: 'Model 2' },
      ]);

      const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
      const result = await useCase.execute('google', 'AIzaKey');

      expect(result.success).toBe(true);
      expect(preferencesStorage.stored?.getModelIdFor('google')).toBe('m1');
    });

    test('repairs a stale selection to the registry default when it is in the fetched list', async () => {
      seedPreferences({ google: 'dead-model' });
      fetchService.seedModels('google', [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'm1', name: 'Model 1' },
      ]);

      const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
      const result = await useCase.execute('google', 'AIzaKey');

      expect(result.success).toBe(true);
      expect(preferencesStorage.stored?.getModelIdFor('google')).toBe(
        'gemini-2.5-flash',
      );
    });

    test('keeps a selection that is still in the fetched list', async () => {
      seedPreferences({ google: 'm2', groq: 'llama-4' });
      fetchService.seedModels('google', [
        { id: 'm1', name: 'Model 1' },
        { id: 'm2', name: 'Model 2' },
      ]);

      const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
      const result = await useCase.execute('google', 'AIzaKey');

      expect(result.success).toBe(true);
      expect(preferencesStorage.stored?.getModelIdFor('google')).toBe('m2');
      expect(preferencesStorage.stored?.getModelIdFor('groq')).toBe('llama-4');
    });

    test('clears the selection when the fetch returns no models', async () => {
      seedPreferences({ google: 'dead-model' });
      fetchService.seedModels('google', []);

      const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
      const result = await useCase.execute('google', 'AIzaKey');

      expect(result.success).toBe(true);
      expect(
        preferencesStorage.stored?.toProps().selectedModels.google,
      ).toBeUndefined();
    });

    test('does not touch preferences when none are stored', async () => {
      fetchService.seedModels('google', [{ id: 'm1', name: 'Model 1' }]);

      const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
      const result = await useCase.execute('google', 'AIzaKey');

      expect(result.success).toBe(true);
      expect(preferencesStorage.stored).toBeNull();
    });

    test('fetch still succeeds when the repair write fails', async () => {
      seedPreferences({ google: 'dead-model' });
      fetchService.seedModels('google', [{ id: 'm1', name: 'Model 1' }]);
      preferencesStorage.failNextSetWith(
        StorageError.writeFailed('userPreferences'),
      );

      const useCase = new FetchModelsUseCase(storage, fetchService, preferencesStorage);
      const result = await useCase.execute('google', 'AIzaKey');

      expect(result.success).toBe(true);
      expect(storage.getStoredModels('google')).toHaveLength(1);
    });
  });
});
