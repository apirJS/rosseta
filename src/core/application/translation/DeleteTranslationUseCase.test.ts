import { describe, expect, test } from 'bun:test';
import { DeleteTranslationUseCase } from './DeleteTranslationUseCase';
import { FakeTranslationStorage } from '../../../../tests/fakes/FakeTranslationStorage';
import { Translation } from '../../domain/translation/Translation';
import { StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeTranslationStorage();
  const useCase = new DeleteTranslationUseCase(storage);
  return { storage, useCase };
}

describe('Application: DeleteTranslationUseCase', () => {
  test('successfully deletes a translation', async () => {
    const { storage, useCase } = createUseCase();
    storage.seed(new Translation('t-1', [], [], 'To delete', new Date()));
    expect(storage.storedCount).toBe(1);

    const result = await useCase.execute('t-1');

    expect(result.success).toBe(true);
    expect(storage.storedCount).toBe(0);
  });

  test('deleting non-existent ID succeeds silently', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute('non-existent-id');

    expect(result.success).toBe(true);
  });

  test('fails when storage.delete() fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(StorageError.writeFailed('translations'));

    const result = await useCase.execute('any-id');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });
});
