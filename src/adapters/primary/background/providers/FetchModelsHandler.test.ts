import { describe, expect, test } from 'bun:test';
import { FetchModelsHandler } from './FetchModelsHandler';
import { FakeTranslationCapabilityStorage } from '../../../../../tests/fakes/FakeTranslationCapabilityStorage';
import { NetworkError, StorageError } from '../../../../shared/errors';
import { FakeCredentialStorage } from '../../../../../tests/fakes/FakeCredentialStorage';
import { FakeModelStorage } from '../../../../../tests/fakes/FakeModelStorage';
import { FakeModelFetchService } from '../../../../../tests/fakes/FakeModelFetchService';
import { FakeCustomProviderStorage } from '../../../../../tests/fakes/FakeCustomProviderStorage';
import { FakeUserPreferencesStorage } from '../../../../../tests/fakes/FakeUserPreferencesStorage';
import { Credentials } from '../../../../core/domain/credential/Credentials';
import { Credential } from '../../../../core/domain/credential/Credential';
import { ApiKey } from '../../../../core/domain/credential/ApiKey';
import { CustomProviderConfig } from '../../../../core/domain/provider/CustomProviderConfig';
import { RefreshProviderModelsUseCase } from '../../../../core/application/providers/RefreshProviderModelsUseCase';
import { v4 as uuidv4 } from 'uuid';
import { FakeProviderMutationLock } from '../../../../../tests/fakes/FakeProviderMutationLock';

function makeCredential(id: string, key: string, provider: string) {
  const apiKey = ApiKey.createWithProvider(key, provider as never);

  if (!apiKey.success) throw new Error('bad key');

  const cred = Credential.create(id, apiKey.data, provider as never);

  if (!cred.success) throw new Error('bad cred');

  return cred.data;
}

function makeCustomConfig(id: string): CustomProviderConfig {
  const config = CustomProviderConfig.create({
    id,
    name: 'My Endpoint',
    baseURL: 'https://my-endpoint.example/v1',
  });

  if (!config.success) throw new Error('bad config');

  return config.data;
}

function createTestContainer() {
  const credentialStorage = new FakeCredentialStorage();
  const modelStorage = new FakeModelStorage();
  const fetchService = new FakeModelFetchService();
  const customProviderStorage = new FakeCustomProviderStorage();
  const capabilityStorage = new FakeTranslationCapabilityStorage();

  const container = new RefreshProviderModelsUseCase({
    credentialStorage,
    modelStorage,
    customProviderStorage,
    capabilityStorage,
    preferencesStorage: new FakeUserPreferencesStorage(),
    modelFetchService: fetchService,
    mutationLock: new FakeProviderMutationLock(),
  });

  return {
    container,
    credentialStorage,
    fetchService,
    customProviderStorage,
    capabilityStorage,
    modelStorage,
  };
}

describe('Adapter: FetchModelsHandler', () => {
  test('returns error for unknown provider', async () => {
    const { container } = createTestContainer();
    const handler = new FetchModelsHandler(container);

    const response = await handler.handle({ provider: 'not-a-provider' });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('VALIDATION_INVALID_INPUT');
  });

  test('returns auth error when no keys exist for the provider', async () => {
    const { container, credentialStorage } = createTestContainer();

    const credentials = Credentials.createEmpty(uuidv4()).add(
      makeCredential('g1', 'AIzaGoogleKey', 'google'),
    );

    credentialStorage.seedWith(credentials);

    const handler = new FetchModelsHandler(container);
    const response = await handler.handle({ provider: 'groq' });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('AUTH_NOT_AUTHENTICATED');
  });

  test('uses a matching-provider key and returns fetched models', async () => {
    const { container, credentialStorage, fetchService } =
      createTestContainer();

    const credentials = Credentials.createEmpty(uuidv4())
      .add(makeCredential('g1', 'AIzaGoogleKey', 'google'))
      .add(makeCredential('q1', 'gsk_groq_key', 'groq'));

    credentialStorage.seedWith(credentials);
    fetchService.seedModels('groq', [{ id: 'llama-4', name: 'Llama 4' }]);

    const handler = new FetchModelsHandler(container);
    const response = await handler.handle({ provider: 'groq' });

    expect(response.success).toBe(true);
    expect(response.models?.map((m) => m.id)).toEqual(['llama-4']);
  });

  test('unknown custom provider id returns validation error', async () => {
    const { container } = createTestContainer();
    const handler = new FetchModelsHandler(container);

    const response = await handler.handle({ provider: 'custom-missing' });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('VALIDATION_INVALID_INPUT');
  });

  test('custom provider without a key returns auth error', async () => {
    const fetchService = new FakeModelFetchService();

    const customProviderStorage = new FakeCustomProviderStorage([
      makeCustomConfig('custom-endpoint'),
    ]);

    const containerWithCustom = new RefreshProviderModelsUseCase({
      credentialStorage: new FakeCredentialStorage(),
      modelStorage: new FakeModelStorage(),
      modelFetchService: fetchService,
      preferencesStorage: new FakeUserPreferencesStorage(),
      customProviderStorage,
      capabilityStorage: new FakeTranslationCapabilityStorage(),
      mutationLock: new FakeProviderMutationLock(),
    });

    const handler = new FetchModelsHandler(containerWithCustom);
    const response = await handler.handle({ provider: 'custom-endpoint' });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('AUTH_NOT_AUTHENTICATED');
  });

  test('custom provider resolves key from credentials and passes baseURL', async () => {
    const fetchService = new FakeModelFetchService();

    const customProviderStorage = new FakeCustomProviderStorage([
      makeCustomConfig('custom-endpoint'),
    ]);

    const credentialStorage = new FakeCredentialStorage();

    credentialStorage.seedWith(
      Credentials.createEmpty(uuidv4()).add(
        makeCredential('c1', 'sk-custom', 'custom-endpoint'),
      ),
    );

    const containerWithCustom = new RefreshProviderModelsUseCase({
      credentialStorage: credentialStorage,
      modelStorage: new FakeModelStorage(),
      modelFetchService: fetchService,
      preferencesStorage: new FakeUserPreferencesStorage(),
      customProviderStorage,
      capabilityStorage: new FakeTranslationCapabilityStorage(),
      mutationLock: new FakeProviderMutationLock(),
    });

    fetchService.seedModels('custom-endpoint', [
      { id: 'custom-model', name: 'Custom Model' },
    ]);

    const handler = new FetchModelsHandler(containerWithCustom);
    const response = await handler.handle({ provider: 'custom-endpoint' });

    expect(response.success).toBe(true);
    expect(response.models?.map((m) => m.id)).toEqual(['custom-model']);

    expect(fetchService.lastCall).toEqual({
      provider: 'custom-endpoint',
      apiKey: 'sk-custom',
      baseURL: 'https://my-endpoint.example/v1',
    });
  });

  test('successful fetching resets all cached models for that provider, including models outside the fetched list', async () => {
    const { container, credentialStorage, fetchService, capabilityStorage } =
      createTestContainer();

    credentialStorage.seedWith(
      Credentials.createEmpty(uuidv4()).add(
        makeCredential('q1', 'key', 'groq'),
      ),
    );

    fetchService.seedModels('groq', [{ id: 'new', name: 'New model' }]);
    seedCompatibility(capabilityStorage, 'fetched-before', 'groq');
    seedCompatibility(capabilityStorage, 'manual-or-removed', 'groq');
    seedCompatibility(capabilityStorage, 'unrelated', 'google');

    const result = await new FetchModelsHandler(container).handle({
      provider: 'groq',
    });

    expect(result.success).toBe(true);
    expect(capabilityStorage.records.get('fetched-before')?.facts).toEqual({});

    expect(capabilityStorage.records.get('manual-or-removed')?.facts).toEqual(
      {},
    );

    expect(
      capabilityStorage.records.get('unrelated')?.facts['feature.structured']
        ?.support,
    ).toBe('unsupported');
  });

  test('a successful custom-provider fetch resets only that custom provider namespace', async () => {
    const {
      container,
      credentialStorage,
      fetchService,
      capabilityStorage,
      customProviderStorage,
    } = createTestContainer();

    await customProviderStorage.save(makeCustomConfig('custom-endpoint'));

    credentialStorage.seedWith(
      Credentials.createEmpty(uuidv4()).add(
        makeCredential('c1', 'key', 'custom-endpoint'),
      ),
    );

    fetchService.seedModels('custom-endpoint', []);

    seedCompatibility(
      capabilityStorage,
      'old-endpoint-scope',
      'custom-endpoint',
    );

    seedCompatibility(capabilityStorage, 'another-custom', 'custom-another');

    expect(
      (
        await new FetchModelsHandler(container).handle({
          provider: 'custom-endpoint',
        })
      ).success,
    ).toBe(true);

    expect(capabilityStorage.records.get('old-endpoint-scope')?.facts).toEqual(
      {},
    );

    expect(
      capabilityStorage.records.get('another-custom')?.facts[
        'feature.structured'
      ]?.support,
    ).toBe('unsupported');
  });

  test('a failed model fetch preserves working compatibility knowledge', async () => {
    const { container, credentialStorage, fetchService, capabilityStorage } =
      createTestContainer();

    credentialStorage.seedWith(
      Credentials.createEmpty(uuidv4()).add(
        makeCredential('q1', 'key', 'groq'),
      ),
    );

    seedCompatibility(capabilityStorage, 'model', 'groq');
    fetchService.seedError('groq', NetworkError.providerUnavailable(503));

    const result = await new FetchModelsHandler(container).handle({
      provider: 'groq',
    });

    expect(result.success).toBe(false);
    expect(capabilityStorage.records.get('model')?.generation).toBe(0);

    expect(
      capabilityStorage.records.get('model')?.facts['feature.structured']
        ?.support,
    ).toBe('unsupported');
  });

  test('a model storage failure does not reset compatibility', async () => {
    const { container, credentialStorage, modelStorage, capabilityStorage } =
      createTestContainer();

    credentialStorage.seedWith(
      Credentials.createEmpty(uuidv4()).add(
        makeCredential('q1', 'key', 'groq'),
      ),
    );

    seedCompatibility(capabilityStorage, 'model', 'groq');
    modelStorage.failNextCallWith(StorageError.writeFailed('models'));

    expect(
      (await new FetchModelsHandler(container).handle({ provider: 'groq' }))
        .success,
    ).toBe(false);

    expect(capabilityStorage.records.get('model')?.generation).toBe(0);
  });

  test('reports compatibility reset failure after models were updated', async () => {
    const { container, credentialStorage, fetchService, capabilityStorage } =
      createTestContainer();

    credentialStorage.seedWith(
      Credentials.createEmpty(uuidv4()).add(
        makeCredential('q1', 'key', 'groq'),
      ),
    );

    fetchService.seedModels('groq', [{ id: 'new', name: 'New' }]);

    capabilityStorage.failWith(
      StorageError.writeFailed('translationCapabilitiesV1'),
    );

    const result = await new FetchModelsHandler(container).handle({
      provider: 'groq',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('STORAGE_WRITE_FAILED');
    expect(result.error?.userMessage).toContain('Models were updated');
  });
});

function seedCompatibility(
  storage: FakeTranslationCapabilityStorage,
  identity: string,
  namespace: string,
): void {
  storage.records.set(identity, {
    identity,
    namespace,
    namespaceGeneration: 0,
    refreshedAt: Date.now(),
    generation: 0,
    legacyCleared: false,
    facts: {
      'feature.structured': {
        support: 'unsupported',
        source: 'explicit-provider',
        observedAt: Date.now(),
        scope: 'model',
      },
    },
  });
}
