import { describe, expect, test } from 'bun:test';
import { FetchModelsHandler } from './FetchModelsHandler';
import {
  FakeCredentialStorage,
} from '../../../../../tests/fakes/FakeCredentialStorage';
import {
  FakeModelStorage,
} from '../../../../../tests/fakes/FakeModelStorage';
import {
  FakeModelFetchService,
} from '../../../../../tests/fakes/FakeModelFetchService';
import {
  FakeCustomProviderStorage,
} from '../../../../../tests/fakes/FakeCustomProviderStorage';
import {
  FakeUserPreferencesStorage,
} from '../../../../../tests/fakes/FakeUserPreferencesStorage';
import {
  GetCredentialsUseCase,
} from '../../../../core/application/auth/GetCredentialUseCase';
import {
  FetchModelsUseCase,
} from '../../../../core/application/models/FetchModelsUseCase';
import {
  GetCustomProvidersUseCase,
} from '../../../../core/application/provider/GetCustomProvidersUseCase';
import { Credentials } from '../../../../core/domain/credential/Credentials';
import { Credential } from '../../../../core/domain/credential/Credential';
import { ApiKey } from '../../../../core/domain/credential/ApiKey';
import { CustomProviderConfig } from '../../../../core/domain/provider/CustomProviderConfig';
import type { Container } from '../../../../shared/di/container-factory';
import { v4 as uuidv4 } from 'uuid';

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

  const container = {
    getCredentialsUseCase: new GetCredentialsUseCase(credentialStorage),
    fetchModelsUseCase: new FetchModelsUseCase(modelStorage, fetchService, new FakeUserPreferencesStorage()),
    getCustomProvidersUseCase: new GetCustomProvidersUseCase(
      customProviderStorage,
    ),
  } as unknown as Container;

  return {
    container,
    credentialStorage,
    fetchService,
    customProviderStorage,
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
    const { container, credentialStorage, fetchService } = createTestContainer();
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
    const containerWithCustom = {
      getCredentialsUseCase: new GetCredentialsUseCase(
        new FakeCredentialStorage(),
      ),
      fetchModelsUseCase: new FetchModelsUseCase(
        new FakeModelStorage(),
        fetchService,
        new FakeUserPreferencesStorage(),
      ),
      getCustomProvidersUseCase: new GetCustomProvidersUseCase(
        customProviderStorage,
      ),
    } as unknown as Container;

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
    const containerWithCustom = {
      getCredentialsUseCase: new GetCredentialsUseCase(credentialStorage),
      fetchModelsUseCase: new FetchModelsUseCase(
        new FakeModelStorage(),
        fetchService,
        new FakeUserPreferencesStorage(),
      ),
      getCustomProvidersUseCase: new GetCustomProvidersUseCase(
        customProviderStorage,
      ),
    } as unknown as Container;
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
});
