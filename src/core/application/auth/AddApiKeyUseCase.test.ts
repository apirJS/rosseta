import { describe, expect, test } from 'bun:test';
import { AddApiKeyUseCase } from './AddApiKeyUseCase';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import type { AddApiKeyCommand } from '../../ports/inbound/auth/IAddApiKeyUseCase';
import { ApiKey } from '../../domain/credential/ApiKey';
import { StorageError, ErrorCode } from '../../../shared/errors';

const VALID_GOOGLE_KEY = 'AIzaSyB4g1X1X1X1X1X1X1X1X1X1X1X1X1X1X1X1';

function createUseCase() {
  const storage = new FakeCredentialStorage();
  const useCase = new AddApiKeyUseCase(storage);
  return { storage, useCase };
}

function makeCommand(
  rawKey: string = VALID_GOOGLE_KEY,
  provider: 'google' | 'groq' = 'google',
): AddApiKeyCommand {
  const result = ApiKey.createWithProvider(rawKey, provider);
  if (!result.success) throw new Error('Test helper: invalid API key');
  return { apiKey: result.data };
}

describe('Application: AddApiKeyUseCase', () => {
  test('successfully adds a new API key', async () => {
    const { useCase } = createUseCase();
    const command = makeCommand();

    const result = await useCase.execute(command);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.hasKeys()).toBe(true);
      expect(result.data.items[0].provider).toBe('google');
    }
  });

  test('adds credential to existing collection', async () => {
    const { useCase } = createUseCase();

    await useCase.execute(makeCommand());

    const result = await useCase.execute(
      makeCommand('gsk_' + 'a'.repeat(52), 'groq'),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(2);
    }
  });

  test('fails when storage.get() fails', async () => {
    const { useCase, storage } = createUseCase();
    storage.failNextCallWith(StorageError.readFailed('credentials'));

    const result = await useCase.execute(makeCommand());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });

  test('fails when storage.save() fails', async () => {
    const { useCase, storage } = createUseCase();
    storage.failNextCallWith(StorageError.writeFailed('credentials'));

    const result = await useCase.execute(makeCommand());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });
});
