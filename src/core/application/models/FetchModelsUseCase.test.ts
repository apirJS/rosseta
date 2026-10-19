import { describe, expect, test, beforeEach } from 'bun:test';
import { FetchModelsUseCase } from './FetchModelsUseCase';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { FakeModelFetchService } from '../../../../tests/fakes/FakeModelFetchService';
import { FakeUserPreferencesStorage } from '../../../../tests/fakes/FakeUserPreferencesStorage';
import {
  FakeCustomProviderStorage,
  makeCustomProviderConfig,
} from '../../../../tests/fakes/FakeCustomProviderStorage';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { UserPreferences } from '../../domain/preferences/UserPreferences';
import { StorageError, NetworkError, AuthError, ErrorCode, type AppError } from '../../../shared/errors';
import { success, type Result } from '../../../shared/types/Result';
import type { ModelInfo } from '../../ports/outbound/IModelFetchService';
import { v4 as uuidv4 } from 'uuid';

class DeferredModelFetchService extends FakeModelFetchService {
  private complete!: (models: Result<ModelInfo[], AppError>) => void;
  private markStarted!: () => void;
  private readonly response = new Promise<Result<ModelInfo[], AppError>>((resolve) => {
    this.complete = resolve;
  });
  readonly started = new Promise<void>((resolve) => { this.markStarted = resolve; });

  override async fetchModels(): Promise<Result<ModelInfo[], AppError>> {
    this.markStarted();
    return this.response;
  }

  resolveModels(models: ModelInfo[]): void {
    this.complete(success(models));
  }
}

describe('Application: FetchModelsUseCase', () => {
  let storage: FakeModelStorage;
  let fetchService: FakeModelFetchService;
  let preferencesStorage: FakeUserPreferencesStorage;
  let customProviderStorage: FakeCustomProviderStorage;

  beforeEach(() => {
    storage = new FakeModelStorage();
    fetchService = new FakeModelFetchService();
    preferencesStorage = new FakeUserPreferencesStorage();
    customProviderStorage = new FakeCustomProviderStorage();
    ProviderRegistry.setModels('google', []);
  });

  function createUseCase(service: FakeModelFetchService = fetchService) {
    return new FetchModelsUseCase(storage, service, preferencesStorage, customProviderStorage);
  }

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

    const useCase = createUseCase();
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

    const useCase = createUseCase();
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

    const useCase = createUseCase();
    const result = await useCase.execute('google', 'bad-key');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
    }
    expect(storage.getStoredModels('google')).toHaveLength(0);
  });

  test('returns failure for providers without a fetcher', async () => {
    fetchService.setFetchable([]);

    const useCase = createUseCase();
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.VALIDATION_INVALID_INPUT);
    }
  });

  test('returns failure when persisting fails', async () => {
    fetchService.seedModels('google', [{ id: 'm1', name: 'M1' }]);
    storage.failNextCallWith(StorageError.writeFailed('models:google'));

    const useCase = createUseCase();
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

    const useCase = createUseCase();
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NetworkError);
    }
  });

  test('saves models for a custom provider that still exists after fetching', async () => {
    await customProviderStorage.save(makeCustomProviderConfig({ id: 'custom-endpoint' }));
    seedPreferences({ google: 'unchanged' });
    fetchService.seedModels('custom-endpoint', [{ id: 'vision-model', name: 'Vision Model' }]);

    const result = await createUseCase().execute('custom-endpoint', 'key');

    expect(result.success).toBe(true);
    expect(storage.getStoredModels('custom-endpoint').map((model) => model.id)).toEqual(['vision-model']);
    expect(preferencesStorage.stored?.selectedModels).toEqual({
      google: 'unchanged',
      'custom-endpoint': 'vision-model',
    });
  });

  test('does not recreate models or selected-model preferences when deletion finishes during the fetch', async () => {
    const provider = 'custom-deleted-during-fetch';
    await customProviderStorage.save(makeCustomProviderConfig({ id: provider }));
    storage.seedModels(provider, [{ id: 'old-model', name: 'Old Model', source: 'manual' }]);
    seedPreferences({ [provider]: 'old-model', google: 'unchanged' });
    const deferredFetch = new DeferredModelFetchService();

    const pending = createUseCase(deferredFetch).execute(provider, 'key');
    await deferredFetch.started;
    await storage.clearModels(provider);
    await preferencesStorage.set({ selectedModels: { google: 'unchanged' } });
    await customProviderStorage.remove(provider);
    const preferenceWritesAfterDeletion = preferencesStorage.setCalls.length;
    deferredFetch.resolveModels([{ id: 'late-model', name: 'Late Model' }]);
    const result = await pending;

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe(ErrorCode.VALIDATION_INVALID_INPUT);
    const models = await storage.getAllModels();
    expect(models.success && models.data).toEqual({});
    expect(preferencesStorage.stored?.selectedModels).toEqual({ google: 'unchanged' });
    expect(preferencesStorage.setCalls).toHaveLength(preferenceWritesAfterDeletion);
  });

  test('propagates a post-fetch custom-provider read failure without saving models or preferences', async () => {
    customProviderStorage.failNext(StorageError.readFailed('customProviders'));
    fetchService.seedModels('custom-endpoint', [{ id: 'model', name: 'Model' }]);
    seedPreferences({ google: 'unchanged' });

    const result = await createUseCase().execute('custom-endpoint', 'key');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    expect(storage.getStoredModels('custom-endpoint')).toEqual([]);
    expect(preferencesStorage.setCalls).toHaveLength(0);
  });

  test('built-in fetching does not depend on custom-provider storage availability', async () => {
    customProviderStorage.failNext(StorageError.readFailed('customProviders'));
    fetchService.seedModels('google', [{ id: 'vision-model', name: 'Vision Model' }]);

    const result = await createUseCase().execute('google', 'key');

    expect(result.success).toBe(true);
    expect(storage.getStoredModels('google')).toHaveLength(1);
    expect((await customProviderStorage.load()).success).toBe(false);
  });

  describe('selected model repair', () => {
    test('repairs a stale selection to the first fetched model when the default is absent', async () => {
      seedPreferences({ google: 'dead-model' });
      fetchService.seedModels('google', [
        { id: 'm1', name: 'Model 1' },
        { id: 'm2', name: 'Model 2' },
      ]);

      const useCase = createUseCase();
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

      const useCase = createUseCase();
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

      const useCase = createUseCase();
      const result = await useCase.execute('google', 'AIzaKey');

      expect(result.success).toBe(true);
      expect(preferencesStorage.stored?.getModelIdFor('google')).toBe('m2');
      expect(preferencesStorage.stored?.getModelIdFor('groq')).toBe('llama-4');
    });

    test('clears the selection when the fetch returns no models', async () => {
      seedPreferences({ google: 'dead-model' });
      fetchService.seedModels('google', []);

      const useCase = createUseCase();
      const result = await useCase.execute('google', 'AIzaKey');

      expect(result.success).toBe(true);
      expect(
        preferencesStorage.stored?.toProps().selectedModels.google,
      ).toBeUndefined();
    });

    test('does not touch preferences when none are stored', async () => {
      fetchService.seedModels('google', [{ id: 'm1', name: 'Model 1' }]);

      const useCase = createUseCase();
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

      const useCase = createUseCase();
      const result = await useCase.execute('google', 'AIzaKey');

      expect(result.success).toBe(true);
      expect(storage.getStoredModels('google')).toHaveLength(1);
    });
  });
});
