import { describe, expect, test } from 'bun:test';
import { ClearAllTranslationsUseCase } from './ClearAllTranslationsUseCase';
import { FakeTranslationStorage } from '../../../../tests/fakes/FakeTranslationStorage';
import { Translation } from '../../domain/translation/Translation';
import { StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeTranslationStorage();
  const useCase = new ClearAllTranslationsUseCase(storage);
  return { storage, useCase };
}

describe('Application: ClearAllTranslationsUseCase', () => {
  test('clears all translations from storage', async () => {
    const { storage, useCase } = createUseCase();
    storage.seed(new Translation('t-1', [], [], 'First', new Date()));
    storage.seed(new Translation('t-2', [], [], 'Second', new Date()));
    expect(storage.storedCount).toBe(2);

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    expect(storage.storedCount).toBe(0);
  });

  test('succeeds when storage is already empty', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute();

    expect(result.success).toBe(true);
  });

  test('fails when storage.clear() fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(StorageError.writeFailed('translations'));

    const result = await useCase.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });
});
