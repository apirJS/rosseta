import { describe, expect, test } from 'bun:test';
import { CheckAuthUseCase } from './CheckAuthUseCase';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { Credentials } from '../../domain/credential/Credentials';
import { Credential } from '../../domain/credential/Credential';
import { ApiKey } from '../../domain/credential/ApiKey';
import { StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeCredentialStorage();
  const useCase = new CheckAuthUseCase(storage);
  return { storage, useCase };
}

function seedWithCredential(storage: FakeCredentialStorage): void {
  const creds = Credentials.createEmpty('creds-1');
  const apiKey = ApiKey.create('AIzaSyTestKeyForCheckAuth000000000000000');
  if (!apiKey.success) throw new Error('Test helper: invalid API key');
  const cred = Credential.create('cred-1', apiKey.data, 'gemini');
  if (!cred.success) throw new Error('Test helper: invalid credential');
  const updated = creds.add(cred.data);
  storage.seedWith(updated);
}

describe('Application: CheckAuthUseCase', () => {
  test('returns true when credentials exist', async () => {
    const { storage, useCase } = createUseCase();
    seedWithCredential(storage);

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(true);
    }
  });

  test('returns false when no credentials stored', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(false);
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
