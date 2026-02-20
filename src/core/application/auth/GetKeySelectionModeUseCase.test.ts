import { describe, expect, test } from 'bun:test';
import { GetKeySelectionModeUseCase } from './GetKeySelectionModeUseCase';
import { FakeKeySelectionStorage } from '../../../../tests/fakes/FakeKeySelectionStorage';
import { KeySelectionMode } from '../../domain/credential/KeySelectionMode';
import { StorageError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeKeySelectionStorage();
  const useCase = new GetKeySelectionModeUseCase(storage);
  return { storage, useCase };
}

describe('Application: GetKeySelectionModeUseCase', () => {
  test('returns manual mode by default', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('manual');
      expect(result.data.isManual).toBe(true);
    }
  });

  test('returns previously set mode', async () => {
    const { storage, useCase } = createUseCase();
    storage.seedMode(KeySelectionMode.autoBalanceGemini());

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('auto-balance:gemini');
    }
  });

  test('fails when storage fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(StorageError.readFailed('keySelectionMode'));

    const result = await useCase.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });
});
