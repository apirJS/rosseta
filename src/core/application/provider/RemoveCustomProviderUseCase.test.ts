import { describe, expect, test } from 'bun:test';
import { RemoveCustomProviderUseCase } from './RemoveCustomProviderUseCase';
import {
  FakeCustomProviderStorage,
  makeCustomProviderConfig,
} from '../../../../tests/fakes/FakeCustomProviderStorage';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { Credential } from '../../domain/credential/Credential';
import { ApiKey } from '../../domain/credential/ApiKey';
import { Credentials } from '../../domain/credential/Credentials';
import { StorageError } from '../../../shared/errors';
import { v4 as uuidv4 } from 'uuid';

function makeCredential(id: string, provider: string): Credential {
  const apiKey = ApiKey.createWithProvider('key-value-123', provider as never);
  if (!apiKey.success) throw new Error('bad key');
  const cred = Credential.create(id, apiKey.data, provider as never);
  if (!cred.success) throw new Error('bad cred');
  return cred.data;
}

function createDeps() {
  const customProviderStorage = new FakeCustomProviderStorage([
    makeCustomProviderConfig({ id: 'custom-a', name: 'A' }),
  ]);
  const credentialStorage = new FakeCredentialStorage();
  const modelStorage = new FakeModelStorage();

  const useCase = new RemoveCustomProviderUseCase(
    customProviderStorage,
    credentialStorage,
    modelStorage,
  );

  return { customProviderStorage, credentialStorage, modelStorage, useCase };
}

describe('Application: RemoveCustomProviderUseCase', () => {
  test('removes the provider', async () => {
    const { customProviderStorage, useCase } = createDeps();

    const result = await useCase.execute('custom-a');

    expect(result.success).toBe(true);
    const stored = await customProviderStorage.load();
    if (stored.success) {
      expect(stored.data).toHaveLength(0);
    }
  });

  test('removes credentials belonging to the provider', async () => {
    const { credentialStorage, useCase } = createDeps();
    const credentials = Credentials.createEmpty(uuidv4())
      .add(makeCredential('k1', 'custom-a'))
      .add(makeCredential('k2', 'google'));
    credentialStorage.seedWith(credentials);

    const result = await useCase.execute('custom-a');

    expect(result.success).toBe(true);
    const remaining = await credentialStorage.get();
    if (remaining.success && remaining.data) {
      expect(remaining.data.items.map((c) => c.id)).toEqual(['k2']);
    }
  });

  test('clears the model list for the provider', async () => {
    const { modelStorage, useCase } = createDeps();
    modelStorage.seedModels('custom-a', [
      { id: 'm1', name: 'Model 1', source: 'manual' },
    ]);

    const result = await useCase.execute('custom-a');

    expect(result.success).toBe(true);
    expect(modelStorage.getStoredModels('custom-a')).toHaveLength(0);
  });

  test('propagates storage failures', async () => {
    const { customProviderStorage, useCase } = createDeps();
    customProviderStorage.failNext(StorageError.writeFailed('customProviders'));

    const result = await useCase.execute('custom-a');

    expect(result.success).toBe(false);
  });
});
