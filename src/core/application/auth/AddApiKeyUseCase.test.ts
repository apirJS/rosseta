import { describe, expect, test } from 'bun:test';
import { AddApiKeyUseCase } from './AddApiKeyUseCase';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { FakeApiKeyValidator } from '../../../../tests/fakes/FakeApiKeyValidator';
import type { AddApiKeyCommand } from '../../ports/inbound/auth/IAddApiKeyUseCase';
import { ApiKey } from '../../domain/credential/ApiKey';
import { AuthError, StorageError, ErrorCode } from '../../../shared/errors';

const VALID_GEMINI_KEY = 'AIzaSyB4g1X1X1X1X1X1X1X1X1X1X1X1X1X1X1X1';

function createUseCase() {
  const storage = new FakeCredentialStorage();
  const validator = new FakeApiKeyValidator();
  const useCase = new AddApiKeyUseCase(storage, validator);
  return { storage, validator, useCase };
}

function makeCommand(rawKey: string = VALID_GEMINI_KEY): AddApiKeyCommand {
  const result = ApiKey.create(rawKey);
  if (!result.success) throw new Error('Test helper: invalid API key');
  return { apiKey: result.data };
}

describe('Application: AddApiKeyUseCase', () => {
  // ==================== HAPPY PATH ====================
  test('successfully adds a new API key', async () => {
    const { useCase } = createUseCase();
    const command = makeCommand();

    const result = await useCase.execute(command);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.hasKeys()).toBe(true);
      expect(result.data.items[0].provider).toBe('gemini');
    }
  });

  test('adds credential to existing collection', async () => {
    const { useCase } = createUseCase();

    // Add first key
    await useCase.execute(makeCommand());

    // Add second key (Groq)
    const result = await useCase.execute(makeCommand('gsk_' + 'a'.repeat(52)));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(2);
    }
  });

  // ==================== FAILURE PATHS ====================
  test('fails when API key validation fails', async () => {
    const { useCase, validator } = createUseCase();
    validator.failWith(AuthError.invalidApiKey());

    const result = await useCase.execute(makeCommand());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthError);
      expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
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

    // First call (get) succeeds, second call (save) fails
    const result = await useCase.execute(makeCommand());
    expect(result.success).toBe(true);

    // Now make save fail on next execution
    storage.failNextCallWith(StorageError.writeFailed('credentials'));
    const result2 = await useCase.execute(makeCommand('gsk_' + 'b'.repeat(52)));

    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error).toBeInstanceOf(StorageError);
      expect(result2.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });
});
