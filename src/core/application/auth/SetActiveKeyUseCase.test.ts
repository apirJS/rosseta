import { describe, expect, test } from 'bun:test';
import { SetActiveKeyUseCase } from './SetActiveKeyUseCase';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { Credentials } from '../../domain/credential/Credentials';
import { Credential } from '../../domain/credential/Credential';
import { ApiKey } from '../../domain/credential/ApiKey';
import { AuthError, StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeCredentialStorage();
  const useCase = new SetActiveKeyUseCase(storage);
  return { storage, useCase };
}

function seedWithTwoCredentials(storage: FakeCredentialStorage): {
  id1: string;
  id2: string;
} {
  const creds = Credentials.createEmpty('creds-1');

  const key1 = ApiKey.create('AIzaSyTestKeyForSetActive1000000000000000');
  if (!key1.success) throw new Error('Test helper: invalid API key');
  const cred1 = Credential.create('cred-1', key1.data, 'gemini');
  if (!cred1.success) throw new Error('Test helper: invalid credential');

  const key2 = ApiKey.create('gsk_' + 'a'.repeat(52));
  if (!key2.success) throw new Error('Test helper: invalid API key');
  const cred2 = Credential.create('cred-2', key2.data, 'groq');
  if (!cred2.success) throw new Error('Test helper: invalid credential');

  const updated = creds.add(cred1.data).add(cred2.data);
  storage.seedWith(updated);

  return { id1: 'cred-1', id2: 'cred-2' };
}

describe('Application: SetActiveKeyUseCase', () => {
  test('switches active credential', async () => {
    const { storage, useCase } = createUseCase();
    const { id1 } = seedWithTwoCredentials(storage);

    // After seeding, cred-2 is active (last added). Switch to cred-1.
    const result = await useCase.execute(id1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.getActive()?.id).toBe(id1);
    }
  });

  test('fails when credential ID does not exist', async () => {
    const { storage, useCase } = createUseCase();
    seedWithTwoCredentials(storage);

    const result = await useCase.execute('non-existent-id');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthError);
      expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
    }
  });

  test('fails when no credentials stored', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute('any-id');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthError);
      expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
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
