// IMPORTANT: mock.module must run before any adapter import
import { resetBrowserMock, seedStore } from '../../../../tests/browser-mock';
import { describe, test, expect, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { BrowserKeySelectionStorageAdapter } from './BrowserKeySelectionStorageAdapter';
import { KeySelectionMode } from '../../../core/domain/credential/KeySelectionMode';
import { ErrorCode } from '../../../shared/errors/ErrorCode';

// Cast storage.local for mock method access
const storage = browser.storage.local as unknown as {
  get: ReturnType<typeof import('bun:test').mock>;
  set: ReturnType<typeof import('bun:test').mock>;
  remove: ReturnType<typeof import('bun:test').mock>;
};

describe('Adapter: BrowserKeySelectionStorageAdapter', () => {
  const adapter = new BrowserKeySelectionStorageAdapter();

  beforeEach(() => resetBrowserMock());

  // ── getMode ──────────────────────────────────────────────────

  test('getMode() returns manual when storage is empty', async () => {
    const result = await adapter.getMode();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('manual');
    }
  });

  test('getMode() returns stored auto-balance mode', async () => {
    seedStore({ keySelectionMode: 'auto-balance:gemini' });

    const result = await adapter.getMode();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('auto-balance:gemini');
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

  // ── setMode ──────────────────────────────────────────────────

  test('setMode() writes mode to storage', async () => {
    const mode = KeySelectionMode.autoBalanceGemini();
    const result = await adapter.setMode(mode);
    expect(result.success).toBe(true);

    // Verify it persisted
    const getResult = await adapter.getMode();
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data.value).toBe('auto-balance:gemini');
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

    const result = await adapter.setMode(KeySelectionMode.autoBalanceGroq());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.cause).toBe(originalError);
    }
  });

  // ── getLastUsedId ────────────────────────────────────────────

  test('getLastUsedId() returns null when no id stored', async () => {
    const result = await adapter.getLastUsedId('gemini');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  test('getLastUsedId() returns stored id for provider', async () => {
    seedStore({ 'lastUsedKeyId:gemini': 'cred-abc' });

    const result = await adapter.getLastUsedId('gemini');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('cred-abc');
    }
  });

  test('getLastUsedId() isolates providers', async () => {
    seedStore({
      'lastUsedKeyId:gemini': 'gemini-id',
      'lastUsedKeyId:groq': 'groq-id',
    });

    const geminiResult = await adapter.getLastUsedId('gemini');
    const groqResult = await adapter.getLastUsedId('groq');

    expect(geminiResult.success).toBe(true);
    expect(groqResult.success).toBe(true);
    if (geminiResult.success) expect(geminiResult.data).toBe('gemini-id');
    if (groqResult.success) expect(groqResult.data).toBe('groq-id');
  });

  test('getLastUsedId() returns StorageError on read failure', async () => {
    storage.get.mockImplementationOnce(async () => {
      throw new Error('read failed');
    });

    const result = await adapter.getLastUsedId('gemini');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });

  // ── setLastUsedId ────────────────────────────────────────────

  test('setLastUsedId() writes id to storage', async () => {
    const result = await adapter.setLastUsedId('gemini', 'cred-123');
    expect(result.success).toBe(true);

    // Verify it persisted
    const getResult = await adapter.getLastUsedId('gemini');
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

    const result = await adapter.setLastUsedId('gemini', 'cred-789');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.cause).toBe(originalError);
    }
  });
});
