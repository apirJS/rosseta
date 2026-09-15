// IMPORTANT: mock.module must run before any adapter import
import { resetBrowserMock, seedStore } from '../../../../tests/browser-mock';
import { describe, test, expect, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { BrowserKeySelectionStorageAdapter } from './BrowserKeySelectionStorageAdapter';
import { KeySelectionMode } from '../../../core/domain/credential/KeySelectionMode';
import { ErrorCode } from '../../../shared/errors/ErrorCode';

const storage = browser.storage.local as unknown as {
  get: ReturnType<typeof import('bun:test').mock>;
  set: ReturnType<typeof import('bun:test').mock>;
  remove: ReturnType<typeof import('bun:test').mock>;
};

describe('Adapter: BrowserKeySelectionStorageAdapter', () => {
  const adapter = new BrowserKeySelectionStorageAdapter();

  beforeEach(() => resetBrowserMock());

  test('getMode() returns manual when storage is empty', async () => {
    const result = await adapter.getMode();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('manual');
    }
  });

  test('getMode() returns stored auto-balance mode', async () => {
    seedStore({ keySelectionMode: 'auto-balance:google' });

    const result = await adapter.getMode();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('auto-balance:google');
    }
  });

  test('getMode() resets to manual for invalid stored value', async () => {
    seedStore({ keySelectionMode: 'garbage-value' });

    const result = await adapter.getMode();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('manual');
    }
  });

  test('getMode() resets legacy auto-balance:gemini to manual and deletes it', async () => {
    seedStore({ keySelectionMode: 'auto-balance:gemini' });

    const result = await adapter.getMode();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('manual');
    }
    expect(storage.remove).toHaveBeenCalledWith('keySelectionMode');
  });

  test('getMode() resets legacy auto-balance:zai to manual', async () => {
    seedStore({ keySelectionMode: 'auto-balance:zai' });

    const result = await adapter.getMode();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('manual');
    }
  });

  test('getMode() resets auto-balance for unknown providers to manual', async () => {
    seedStore({ keySelectionMode: 'auto-balance:not-a-provider' });

    const result = await adapter.getMode();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('manual');
    }
  });

  test('getMode() resets empty auto-balance suffix to manual', async () => {
    seedStore({ keySelectionMode: 'auto-balance:' });

    const result = await adapter.getMode();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('manual');
    }
  });

  test('getMode() returns StorageError on read failure', async () => {
    storage.get.mockImplementationOnce(async () => {
      throw new Error('read failed');
    });

    const result = await adapter.getMode();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });

  test('setMode() writes mode to storage', async () => {
    const mode = KeySelectionMode.autoBalance('google');
    const result = await adapter.setMode(mode);
    expect(result.success).toBe(true);

    const getResult = await adapter.getMode();
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data.value).toBe('auto-balance:google');
    }
  });

  test('setMode() returns StorageError on write failure', async () => {
    storage.set.mockImplementationOnce(async () => {
      throw new Error('disk full');
    });

    const result = await adapter.setMode(KeySelectionMode.manual());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });

  test('setMode() passes Error cause through on write failure', async () => {
    const originalError = new Error('quota exceeded');
    storage.set.mockImplementationOnce(async () => {
      throw originalError;
    });

    const result = await adapter.setMode(KeySelectionMode.autoBalance('groq'));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.cause).toBe(originalError);
    }
  });

  test('getLastUsedId() returns null when no id stored', async () => {
    const result = await adapter.getLastUsedId('google');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  test('getLastUsedId() returns stored id for provider', async () => {
    seedStore({ 'lastUsedKeyId:google': 'cred-abc' });

    const result = await adapter.getLastUsedId('google');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('cred-abc');
    }
  });

  test('getLastUsedId() ignores legacy provider keys', async () => {
    seedStore({ 'lastUsedKeyId:gemini': 'legacy-cred' });

    const result = await adapter.getLastUsedId('google');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  test('getLastUsedId() isolates providers', async () => {
    seedStore({
      'lastUsedKeyId:google': 'google-id',
      'lastUsedKeyId:groq': 'groq-id',
    });

    const googleResult = await adapter.getLastUsedId('google');
    const groqResult = await adapter.getLastUsedId('groq');

    expect(googleResult.success).toBe(true);
    expect(groqResult.success).toBe(true);
    if (googleResult.success) expect(googleResult.data).toBe('google-id');
    if (groqResult.success) expect(groqResult.data).toBe('groq-id');
  });

  test('getLastUsedId() returns StorageError on read failure', async () => {
    storage.get.mockImplementationOnce(async () => {
      throw new Error('read failed');
    });

    const result = await adapter.getLastUsedId('google');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });

  test('setLastUsedId() writes id to storage', async () => {
    const result = await adapter.setLastUsedId('google', 'cred-123');
    expect(result.success).toBe(true);

    const getResult = await adapter.getLastUsedId('google');
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data).toBe('cred-123');
    }
  });

  test('setLastUsedId() returns StorageError on write failure', async () => {
    storage.set.mockImplementationOnce(async () => {
      throw new Error('write failed');
    });

    const result = await adapter.setLastUsedId('groq', 'cred-456');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });

  test('setLastUsedId() with Error cause passes it through', async () => {
    const originalError = new Error('quota exceeded');
    storage.set.mockImplementationOnce(async () => {
      throw originalError;
    });

    const result = await adapter.setLastUsedId('google', 'cred-789');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.cause).toBe(originalError);
    }
  });
});
