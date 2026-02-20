import { describe, expect, test } from 'bun:test';
import { UpdatePreferencesUseCase } from './UpdatePreferencesUseCase';
import { FakeUserPreferencesStorage } from '../../../../tests/fakes/FakeUserPreferencesStorage';
import type { UpdatePreferencesCommand } from '../../ports/inbound/preferences/IUpdatePreferencesUseCase';
import { StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeUserPreferencesStorage();
  const useCase = new UpdatePreferencesUseCase(storage);
  return { storage, useCase };
}

describe('Application: UpdatePreferencesUseCase', () => {
  test('successfully updates preferences', async () => {
    const { useCase } = createUseCase();
    const command: UpdatePreferencesCommand = {
      preferences: { theme: 'dark' },
    };

    const result = await useCase.execute(command);

    expect(result.success).toBe(true);
  });

  test('accepts partial updates', async () => {
    const { useCase } = createUseCase();
    const command: UpdatePreferencesCommand = {
      preferences: { targetLanguage: 'ja-JP' },
    };

    const result = await useCase.execute(command);

    expect(result.success).toBe(true);
  });

  test('fails when storage.set() fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(StorageError.writeFailed('preferences'));

    const command: UpdatePreferencesCommand = {
      preferences: { theme: 'light' },
    };

    const result = await useCase.execute(command);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });
});
