import { describe, expect, test } from 'bun:test';
import { GetCredentialsUseCase } from './GetCredentialUseCase';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { Credentials } from '../../domain/credential/Credentials';
import { Credential } from '../../domain/credential/Credential';
import { ApiKey } from '../../domain/credential/ApiKey';
import { StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeCredentialStorage();
  const useCase = new GetCredentialsUseCase(storage);
  return { storage, useCase };
}

describe('Application: GetCredentialsUseCase', () => {
  test('returns null when no credentials stored', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  test('returns stored credentials', async () => {
    const { storage, useCase } = createUseCase();

    const creds = Credentials.createEmpty('creds-1');
    const apiKey = ApiKey.create('AIzaSyTestKeyForGetCreds0000000000000000');
    if (!apiKey.success) throw new Error('Test helper: invalid API key');
    const cred = Credential.create('cred-1', apiKey.data, 'gemini');
    if (!cred.success) throw new Error('Test helper: invalid credential');
    storage.seedWith(creds.add(cred.data));

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data!.items).toHaveLength(1);
    }
  });

  test('fails when storage.get() fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(StorageError.readFailed('credentials'));

    const result = await useCase.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });
});
