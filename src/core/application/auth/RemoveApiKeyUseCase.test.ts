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
  const apiKey = ApiKey.createWithProvider(
    'AIzaSyTestKeyForRemove00000000000000000000',
    'google',
  );
  if (!apiKey.success) throw new Error('Test helper: invalid API key');
  const cred = Credential.create('cred-1', apiKey.data, 'google');
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

  test('promotes next credential when the active key is removed', async () => {
    const { storage, useCase } = createUseCase();
    seedWithTwoCredentials(storage);

    const result = await useCase.execute('cred-2');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.activeCredentialId).toBe('cred-1');
    }
  });

  test('fails when storage write fails', async () => {
    const { storage, useCase } = createUseCase();
    seedWithCredentials(storage);
    storage.failNextCallWith(StorageError.writeFailed('credentials'));

    const result = await useCase.execute('cred-1');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });
});

function seedWithTwoCredentials(storage: FakeCredentialStorage) {
  const creds = Credentials.createEmpty('creds-1');
  const apiKey1 = ApiKey.createWithProvider(
    'AIzaSyTestKeyForRemove00000000000000000000',
    'google',
  );
  if (!apiKey1.success) throw new Error('bad key');
  const cred1 = Credential.create('cred-1', apiKey1.data, 'google');
  if (!cred1.success) throw new Error('bad cred');
  const apiKey2 = ApiKey.createWithProvider('gsk_' + 'b'.repeat(52), 'groq');
  if (!apiKey2.success) throw new Error('bad key');
  const cred2 = Credential.create('cred-2', apiKey2.data, 'groq');
  if (!cred2.success) throw new Error('bad cred');
  storage.seedWith(creds.add(cred1.data).add(cred2.data));
}
