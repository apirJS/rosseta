import { describe, expect, test } from 'bun:test';
import { GetShortcutUseCase } from './GetShortcutUseCase';
import { FakeCommandStorage } from '../../../../tests/fakes/FakeCommandStorage';
import { BrowserError, ErrorCode } from '../../../shared/errors';

function createUseCase() {
  const storage = new FakeCommandStorage();
  const useCase = new GetShortcutUseCase(storage);
  return { storage, useCase };
}

describe('Application: GetShortcutUseCase', () => {
  test('returns null when no shortcut is set for the command', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute('START_EXTENSION');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  test('returns the shortcut when one is set', async () => {
    const { storage, useCase } = createUseCase();
    storage.seedShortcut('START_EXTENSION', 'Ctrl+Shift+Space');

    const result = await useCase.execute('START_EXTENSION');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Ctrl+Shift+Space');
    }
  });

  test('returns null for unregistered command even when others exist', async () => {
    const { storage, useCase } = createUseCase();
    storage.seedShortcut('START_EXTENSION', 'Ctrl+Shift+Space');

    const result = await useCase.execute('UNKNOWN_COMMAND');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  test('fails when storage.getShortcut() fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(BrowserError.communicationFailed());

    const result = await useCase.execute('START_EXTENSION');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(BrowserError);
      expect(result.error.code).toBe(ErrorCode.BROWSER_COMMUNICATION_FAILED);
    }
  });
});
