import { describe, expect, test } from 'bun:test';
import { GetTranslationUseCase } from './GetTranslationUseCase';
import { FakeTranslationStorage } from '../../../../tests/fakes/FakeTranslationStorage';
import { Translation } from '../../domain/translation/Translation';
import { StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeTranslationStorage();
  const useCase = new GetTranslationUseCase(storage);
  return { storage, useCase };
}

describe('Application: GetTranslationUseCase', () => {
  test('returns null when translation not found', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute('non-existent-id');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  test('returns a stored translation by ID', async () => {
    const { storage, useCase } = createUseCase();
    const translation = new Translation(
      't-1',
      [],
      [],
      'A test translation',
      new Date(),
    );
    storage.seed(translation);

    const result = await useCase.execute('t-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data!.id).toBe('t-1');
      expect(result.data!.description).toBe('A test translation');
    }
  });

  test('fails when storage.getById() fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(StorageError.readFailed('translations'));

    const result = await useCase.execute('any-id');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });
});
