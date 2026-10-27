import { describe, expect, test, beforeEach } from 'bun:test';
import { RefreshProviderModelsUseCase } from './RefreshProviderModelsUseCase';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { FakeModelFetchService } from '../../../../tests/fakes/FakeModelFetchService';
import { FakeUserPreferencesStorage } from '../../../../tests/fakes/FakeUserPreferencesStorage';
import {
  FakeCustomProviderStorage,
  makeCustomProviderConfig,
} from '../../../../tests/fakes/FakeCustomProviderStorage';
import { UserPreferences } from '../../domain/preferences/UserPreferences';
import {
  StorageError,
  NetworkError,
  AuthError,
  ErrorCode,
  type AppError,
} from '../../../shared/errors';
import { success, type Result } from '../../../shared/types/Result';
import type { ModelInfo } from '../../ports/outbound/IModelFetchService';
import { v4 as uuidv4 } from 'uuid';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { FakeTranslationCapabilityStorage } from '../../../../tests/fakes/FakeTranslationCapabilityStorage';
import { Credentials } from '../../domain/credential/Credentials';
import { ApiKey } from '../../domain/credential/ApiKey';
import { Credential } from '../../domain/credential/Credential';
import { FakeProviderMutationLock } from '../../../../tests/fakes/FakeProviderMutationLock';
import { FakeKeySelectionStorage } from '../../../../tests/fakes/FakeKeySelectionStorage';
import { RemoveCustomProviderUseCase } from './RemoveCustomProviderUseCase';

function deferred() {
  let resolve!: () => void;

  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

class DeferredModelFetchService extends FakeModelFetchService {
  private complete!: (models: Result<ModelInfo[], AppError>) => void;
  private markStarted!: () => void;
  private readonly response = new Promise<Result<ModelInfo[], AppError>>(
    (resolve) => {
      this.complete = resolve;
    },
  );
  readonly started = new Promise<void>((resolve) => {
    this.markStarted = resolve;
  });

  override async fetchModels(): Promise<Result<ModelInfo[], AppError>> {
    this.markStarted();

    return this.response;
  }

  resolveModels(models: ModelInfo[]): void {
    this.complete(success(models));
  }
}

const makeKey = (provider: 'google' | 'groq', id: string) => {
  const key = ApiKey.createWithProvider(id, provider);

  if (!key.success) throw key.error;

  const result = Credential.create(id, key.data, provider);

  if (!result.success) throw result.error;

  return result.data;
};

describe('Application: RefreshProviderModelsUseCase', () => {
  let storage: FakeModelStorage;
  let fetchService: FakeModelFetchService;
  let preferencesStorage: FakeUserPreferencesStorage;
  let customProviderStorage: FakeCustomProviderStorage;
  let credentialStorage: FakeCredentialStorage;
  let capabilityStorage: FakeTranslationCapabilityStorage;
  let mutationLock: FakeProviderMutationLock;

  beforeEach(() => {
    storage = new FakeModelStorage();
    fetchService = new FakeModelFetchService();
    preferencesStorage = new FakeUserPreferencesStorage();
    customProviderStorage = new FakeCustomProviderStorage();
    credentialStorage = new FakeCredentialStorage();
    capabilityStorage = new FakeTranslationCapabilityStorage();
    mutationLock = new FakeProviderMutationLock();
    seedKey('google');
  });

  function createUseCase(service: FakeModelFetchService = fetchService) {
    return new RefreshProviderModelsUseCase({
      modelStorage: storage,
      modelFetchService: service,
      preferencesStorage,
      customProviderStorage,
      credentialStorage,
      capabilityStorage,
      mutationLock,
    });
  }

  function createRemoval() {
    return new RemoveCustomProviderUseCase(
      customProviderStorage,
      credentialStorage,
      storage,
      preferencesStorage,
      new FakeKeySelectionStorage(),
      mutationLock,
    );
  }

  function seedKey(provider: 'google' | `custom-${string}`) {
    const key = ApiKey.createWithProvider('test-key', provider);

    if (!key.success) throw key.error;

    const credential = Credential.create(uuidv4(), key.data, provider);

    if (!credential.success) throw credential.error;

    credentialStorage.seedWith(
      Credentials.createEmpty('credentials').add(credential.data),
    );
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

  test('fetches models, persists the catalog, and refreshes compatibility', async () => {
    fetchService.seedModels('google', [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ]);

    const useCase = createUseCase();
    const result = await useCase.execute('google');

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].source).toBe('fetched');
    }

    expect(storage.getStoredModels('google')).toHaveLength(2);
    expect(capabilityStorage.resetNamespaceCalls).toEqual(['google']);
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
    const result = await useCase.execute('google');

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
    const result = await useCase.execute('google');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
    }

    expect(storage.getStoredModels('google')).toHaveLength(0);
  });

  test('returns failure for providers without a fetcher', async () => {
    fetchService.setFetchable([]);

    const useCase = createUseCase();
    const result = await useCase.execute('google');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.VALIDATION_INVALID_INPUT);
    }
  });

  test('returns failure when persisting fails', async () => {
    fetchService.seedModels('google', [{ id: 'm1', name: 'M1' }]);
    storage.failNextCallWith(StorageError.writeFailed('models:google'));

    const useCase = createUseCase();
    const result = await useCase.execute('google');

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
    const result = await useCase.execute('google');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBeInstanceOf(NetworkError);
    }
  });

  test('saves models for a custom provider that still exists after fetching', async () => {
    seedKey('custom-endpoint');

    await customProviderStorage.save(
      makeCustomProviderConfig({ id: 'custom-endpoint' }),
    );

    seedPreferences({ google: 'unchanged' });

    fetchService.seedModels('custom-endpoint', [
      { id: 'vision-model', name: 'Vision Model' },
    ]);

    const result = await createUseCase().execute('custom-endpoint');

    expect(result.success).toBe(true);

    expect(
      storage.getStoredModels('custom-endpoint').map((model) => model.id),
    ).toEqual(['vision-model']);

    expect(preferencesStorage.stored?.selectedModels).toEqual({
      google: 'unchanged',
      'custom-endpoint': 'vision-model',
    });
  });

  test('does not recreate models or selected-model preferences when deletion finishes during the fetch', async () => {
    const provider = 'custom-deleted-during-fetch';

    seedKey(provider);

    await customProviderStorage.save(
      makeCustomProviderConfig({ id: provider }),
    );

    storage.seedModels(provider, [
      { id: 'old-model', name: 'Old Model', source: 'manual' },
    ]);

    seedPreferences({ [provider]: 'old-model', google: 'unchanged' });

    const deferredFetch = new DeferredModelFetchService();

    const pending = createUseCase(deferredFetch).execute(provider);

    await deferredFetch.started;
    await storage.clearModels(provider);
    await preferencesStorage.set({ selectedModels: { google: 'unchanged' } });
    await customProviderStorage.remove(provider);

    const preferenceWritesAfterDeletion = preferencesStorage.setCalls.length;

    deferredFetch.resolveModels([{ id: 'late-model', name: 'Late Model' }]);

    const result = await pending;

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.VALIDATION_INVALID_INPUT);

    const models = await storage.getAllModels();

    expect(models.success && models.data).toEqual({});

    expect(preferencesStorage.stored?.selectedModels).toEqual({
      google: 'unchanged',
    });

    expect(preferencesStorage.setCalls).toHaveLength(
      preferenceWritesAfterDeletion,
    );
  });

  test('propagates a post-fetch custom-provider read failure without saving models or preferences', async () => {
    customProviderStorage.failNext(StorageError.readFailed('customProviders'));

    fetchService.seedModels('custom-endpoint', [
      { id: 'model', name: 'Model' },
    ]);

    seedPreferences({ google: 'unchanged' });

    const result = await createUseCase().execute('custom-endpoint');

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    expect(storage.getStoredModels('custom-endpoint')).toEqual([]);
    expect(preferencesStorage.setCalls).toHaveLength(0);
  });

  test('deletion waits for a refresh that passed its existence check, then removes its catalog and selection', async () => {
    const provider = 'custom-delete-after-check';

    seedKey(provider);

    await customProviderStorage.save(
      makeCustomProviderConfig({ id: provider }),
    );

    seedPreferences({ [provider]: 'old', google: 'unchanged' });
    fetchService.seedModels(provider, [{ id: 'fresh', name: 'Fresh' }]);

    const reading = deferred();
    const release = deferred();
    const originalRead = storage.getModels.bind(storage);
    let reads = 0;

    storage.getModels = async (id) => {
      if (++reads === 2) {
        reading.resolve();
        await release.promise;
      }

      return originalRead(id);
    };

    const refreshing = createUseCase().execute(provider);

    await reading.promise;

    let deleted = false;

    const deleting = createRemoval()
      .execute(provider)
      .then((result) => {
        deleted = true;

        return result;
      });

    // Flush microtasks so an unprotected deletion completes deterministically.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const deletionWaited = !deleted;

    release.resolve();
    expect((await refreshing).success).toBe(true);
    expect((await deleting).success).toBe(true);
    expect(deletionWaited).toBe(true);
    expect(storage.getStoredModels(provider)).toEqual([]);

    expect(preferencesStorage.stored?.selectedModels).toEqual({
      google: 'unchanged',
    });

    const configs = await customProviderStorage.load();

    expect(configs.success && configs.data).toEqual([]);
  });

  test('refresh waits for staged deletion before checking existence and cannot restore deleted state', async () => {
    const provider = 'custom-refresh-during-delete';

    seedKey(provider);

    await customProviderStorage.save(
      makeCustomProviderConfig({ id: provider }),
    );

    seedPreferences({ [provider]: 'old', google: 'unchanged' });

    storage.seedModels(provider, [
      { id: 'old', name: 'Old', source: 'manual' },
    ]);

    const fetch = new DeferredModelFetchService();
    const clearing = deferred();
    const release = deferred();
    const originalClear = storage.clearModels.bind(storage);

    storage.clearModels = async (id) => {
      clearing.resolve();
      await release.promise;

      return originalClear(id);
    };

    const pendingRefresh = createUseCase(fetch).execute(provider);

    await fetch.started;

    const deleting = createRemoval().execute(provider);

    await clearing.promise;

    let refreshed = false;

    const refreshing = pendingRefresh.then((result) => {
      refreshed = true;

      return result;
    });

    fetch.resolveModels([{ id: 'fresh', name: 'Fresh' }]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const refreshWaited = !refreshed;

    release.resolve();
    expect((await deleting).success).toBe(true);
    expect((await refreshing).success).toBe(false);
    expect(refreshWaited).toBe(true);
    expect(storage.getStoredModels(provider)).toEqual([]);

    expect(preferencesStorage.stored?.selectedModels).toEqual({
      google: 'unchanged',
    });

    expect(capabilityStorage.resetNamespaceCalls).toEqual([]);
  });

  test('does not hold the provider mutation lock during model networking', async () => {
    const provider = 'custom-delete-during-network';

    seedKey(provider);

    await customProviderStorage.save(
      makeCustomProviderConfig({ id: provider }),
    );

    seedPreferences({ [provider]: 'old' });

    const fetch = new DeferredModelFetchService();
    const refreshing = createUseCase(fetch).execute(provider);

    await fetch.started;
    expect((await createRemoval().execute(provider)).success).toBe(true);
    fetch.resolveModels([{ id: 'late', name: 'Late' }]);
    expect((await refreshing).success).toBe(false);
    expect(storage.getStoredModels(provider)).toEqual([]);
    expect(preferencesStorage.stored?.selectedModels).toEqual({});
  });

  test.each(['key', 'endpoint', 'catalog', 'selection'] as const)(
    'does not overwrite imported settings after the %s changes during networking',
    async (changed) => {
      const provider = 'custom-import-during-fetch';

      seedKey(provider);

      await customProviderStorage.save(
        makeCustomProviderConfig({ id: provider }),
      );

      const fetch = new DeferredModelFetchService();
      const pending = createUseCase(fetch).execute(provider);

      await fetch.started;

      if (changed === 'key') {
        const key = ApiKey.createWithProvider('imported-key', provider);

        if (!key.success) throw key.error;

        const credential = Credential.create('imported-id', key.data, provider);

        if (!credential.success) throw credential.error;

        credentialStorage.seedWith(
          Credentials.createEmpty('imported').add(credential.data),
        );
      }

      if (changed === 'endpoint')
        await customProviderStorage.save(
          makeCustomProviderConfig({
            id: provider,
            baseURL: 'https://imported.example/v1',
          }),
        );
      if (changed === 'selection')
        seedPreferences({ [provider]: 'imported-selection' });
      if (changed === 'catalog')
        storage.seedModels(provider, [
          { id: 'imported-model', name: 'Imported', source: 'manual' },
        ]);
      fetch.resolveModels([{ id: 'stale-response', name: 'Stale' }]);

      const result = await pending;

      expect(result.success).toBe(false);

      expect(
        storage
          .getStoredModels(provider)
          .some((model) => model.id === 'stale-response'),
      ).toBe(false);

      expect(capabilityStorage.resetNamespaceCalls).toEqual([]);
    },
  );

  test('returns lock acquisition failure without persisting models or resetting compatibility', async () => {
    const error = StorageError.writeFailed('provider mutation lock');

    mutationLock.failNext(error);
    fetchService.seedModels('google', [{ id: 'fresh', name: 'Fresh' }]);

    const result = await createUseCase().execute('google');

    expect(result).toEqual({ success: false, error });
    expect(storage.getStoredModels('google')).toEqual([]);
    expect(capabilityStorage.resetNamespaceCalls).toEqual([]);
  });

  test('built-in fetching does not depend on custom-provider storage availability', async () => {
    customProviderStorage.failNext(StorageError.readFailed('customProviders'));

    fetchService.seedModels('google', [
      { id: 'vision-model', name: 'Vision Model' },
    ]);

    const result = await createUseCase().execute('google');

    expect(result.success).toBe(true);
    expect(storage.getStoredModels('google')).toHaveLength(1);
    expect((await customProviderStorage.load()).success).toBe(false);
  });

  test('does not reset compatibility when fetching fails', async () => {
    fetchService.seedError('google', NetworkError.connectionFailed());
    expect((await createUseCase().execute('google')).success).toBe(false);
    expect(capabilityStorage.resetNamespaceCalls).toEqual([]);
  });

  test('reports reset failure after retaining the refreshed catalog', async () => {
    fetchService.seedModels('google', [{ id: 'fresh', name: 'Fresh' }]);

    capabilityStorage.failWith(
      StorageError.writeFailed('translationCapabilitiesV1'),
    );

    const result = await createUseCase().execute('google');

    expect(!result.success && result.error.userMessage).toBe(
      'Models were updated, but compatibility could not be reset. Try fetching models again.',
    );

    expect(storage.getStoredModels('google').map((model) => model.id)).toEqual([
      'fresh',
    ]);

    expect(capabilityStorage.resetNamespaceCalls).toEqual(['google']);
  });

  test('uses the active matching-provider key, otherwise its first key', async () => {
    const first = makeKey('google', 'first-key');
    const second = makeKey('google', 'second-key');
    const other = makeKey('groq', 'other-key');

    credentialStorage.seedWith(
      Credentials.createEmpty('credentials').add(first).add(second),
    );

    await createUseCase().execute('google');
    expect(fetchService.lastCall?.apiKey).toBe('second-key');

    credentialStorage.seedWith(
      Credentials.createEmpty('credentials').add(first).add(second).add(other),
    );

    await createUseCase().execute('google');
    expect(fetchService.lastCall?.apiKey).toBe('first-key');
  });

  test('does not reset compatibility when catalog persistence fails', async () => {
    const failingStorage = new FakeModelStorage();

    failingStorage.setModels = async () => ({
      success: false,
      error: StorageError.writeFailed('models:google'),
    });

    storage = failingStorage;
    fetchService.seedModels('google', [{ id: 'fresh', name: 'Fresh' }]);
    expect((await createUseCase().execute('google')).success).toBe(false);
    expect(capabilityStorage.resetNamespaceCalls).toEqual([]);
  });

  test('rejects unknown providers and missing keys before catalog networking', async () => {
    expect((await createUseCase().execute('unknown-provider')).success).toBe(
      false,
    );

    credentialStorage = new FakeCredentialStorage();
    expect((await createUseCase().execute('google')).success).toBe(false);
    expect(fetchService.lastCall).toBeNull();
  });

  describe('selected model repair', () => {
    test('repairs a stale selection to the first fetched model when the default is absent', async () => {
      seedPreferences({ google: 'dead-model' });

      fetchService.seedModels('google', [
        { id: 'm1', name: 'Model 1' },
        { id: 'm2', name: 'Model 2' },
      ]);

      const useCase = createUseCase();
      const result = await useCase.execute('google');

      expect(result.success).toBe(true);
      expect(preferencesStorage.stored?.getModelIdFor('google')).toBe('m1');
    });

    test('repairs a stale selection to the built-in default when it is in the fetched list', async () => {
      seedPreferences({ google: 'dead-model' });

      fetchService.seedModels('google', [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'm1', name: 'Model 1' },
      ]);

      const useCase = createUseCase();
      const result = await useCase.execute('google');

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
      const result = await useCase.execute('google');

      expect(result.success).toBe(true);
      expect(preferencesStorage.stored?.getModelIdFor('google')).toBe('m2');
      expect(preferencesStorage.stored?.getModelIdFor('groq')).toBe('llama-4');
    });

    test('clears the selection when the fetch returns no models', async () => {
      seedPreferences({ google: 'dead-model' });
      fetchService.seedModels('google', []);

      const useCase = createUseCase();
      const result = await useCase.execute('google');

      expect(result.success).toBe(true);

      expect(
        preferencesStorage.stored?.toProps().selectedModels.google,
      ).toBeUndefined();
    });

    test('does not touch preferences when none are stored', async () => {
      fetchService.seedModels('google', [{ id: 'm1', name: 'Model 1' }]);

      const useCase = createUseCase();
      const result = await useCase.execute('google');

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
      const result = await useCase.execute('google');

      expect(result.success).toBe(true);
      expect(storage.getStoredModels('google')).toHaveLength(1);
    });
  });
});
