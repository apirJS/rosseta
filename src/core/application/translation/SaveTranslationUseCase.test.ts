import { describe, expect, test } from 'bun:test';
import { SaveTranslationUseCase } from './SaveTranslationUseCase';
import { FakeTranslationStorage } from '../../../../tests/fakes/FakeTranslationStorage';
import { Translation } from '../../domain/translation/Translation';
import type { SaveTranslationCommand } from '../../ports/inbound/translation/ISaveTranslationUseCase';
import { StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeTranslationStorage();
  const useCase = new SaveTranslationUseCase(storage);
  return { storage, useCase };
}

function makeTranslation(id: string = 't-1'): Translation {
  return new Translation(id, [], [], 'Test translation', new Date());
}

describe('Application: SaveTranslationUseCase', () => {
  test('successfully saves a translation', async () => {
    const { storage, useCase } = createUseCase();
    const command: SaveTranslationCommand = {
      translation: makeTranslation(),
    };

    const result = await useCase.execute(command);

    expect(result.success).toBe(true);
    expect(storage.storedCount).toBe(1);
  });

  test('fails when storage.save() fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(StorageError.writeFailed('translations'));

    const command: SaveTranslationCommand = {
      translation: makeTranslation(),
    };

    const result = await useCase.execute(command);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });
});
