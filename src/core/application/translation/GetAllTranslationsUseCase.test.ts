import { describe, expect, test } from 'bun:test';
import { GetAllTranslationsUseCase } from './GetAllTranslationsUseCase';
import { FakeTranslationStorage } from '../../../../tests/fakes/FakeTranslationStorage';
import { Translation } from '../../domain/translation/Translation';
import { StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeTranslationStorage();
  const useCase = new GetAllTranslationsUseCase(storage);
  return { storage, useCase };
}

describe('Application: GetAllTranslationsUseCase', () => {
  test('returns empty array when no translations stored', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  test('returns all stored translations', async () => {
    const { storage, useCase } = createUseCase();
    storage.seed(new Translation('t-1', [], [], 'First', new Date()));
    storage.seed(new Translation('t-2', [], [], 'Second', new Date()));

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  test('fails when storage.getAll() fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(StorageError.readFailed('translations'));

    const result = await useCase.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });
});
