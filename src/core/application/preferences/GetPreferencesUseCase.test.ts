import { describe, expect, test } from 'bun:test';
import { GetPreferencesUseCase } from './GetPreferencesUseCase';
import { FakeUserPreferencesStorage } from '../../../../tests/fakes/FakeUserPreferencesStorage';
import { UserPreferences } from '../../domain/preferences/UserPreferences';
import { StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeUserPreferencesStorage();
  const useCase = new GetPreferencesUseCase(storage);
  return { storage, useCase };
}

describe('Application: GetPreferencesUseCase', () => {
  test('returns null when no preferences stored', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  test('returns stored preferences', async () => {
    const { storage, useCase } = createUseCase();
    const prefs = UserPreferences.createDefault('prefs-1');
    storage.seed(prefs);

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data!.id).toBe('prefs-1');
      expect(result.data!.theme.isSystem).toBe(true);
    }
  });

  test('fails when storage.get() fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(StorageError.readFailed('preferences'));

    const result = await useCase.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });
});
