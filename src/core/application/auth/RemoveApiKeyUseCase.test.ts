import { describe, expect, test } from 'bun:test';
import { RemoveApiKeyUseCase } from './RemoveApiKeyUseCase';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { Credentials } from '../../domain/credential/Credentials';
import { Credential } from '../../domain/credential/Credential';
import { ApiKey } from '../../domain/credential/ApiKey';
import { StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeCredentialStorage();
  const useCase = new RemoveApiKeyUseCase(storage);
  return { storage, useCase };
}

function seedWithCredentials(storage: FakeCredentialStorage): string {
  const creds = Credentials.createEmpty('creds-1');
  const apiKey = ApiKey.create('AIzaSyTestKeyForRemove00000000000000000000');
  if (!apiKey.success) throw new Error('Test helper: invalid API key');
  const cred = Credential.create('cred-1', apiKey.data, 'gemini');
  if (!cred.success) throw new Error('Test helper: invalid credential');
  storage.seedWith(creds.add(cred.data));
  return 'cred-1';
}

describe('Application: RemoveApiKeyUseCase', () => {
  test('removes an existing credential', async () => {
    const { storage, useCase } = createUseCase();
    const credId = seedWithCredentials(storage);

    const result = await useCase.execute(credId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(0);
      expect(result.data.hasKeys()).toBe(false);
    }
  });

  test('removing non-existent ID is a no-op', async () => {
    const { storage, useCase } = createUseCase();
    seedWithCredentials(storage);

    const result = await useCase.execute('non-existent-id');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(1);
    }
  });

  test('works when storage is empty (creates empty credentials)', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute('any-id');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(0);
    }
  });

  test('fails when storage.get() fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(StorageError.readFailed('credentials'));

    const result = await useCase.execute('any-id');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });
});
