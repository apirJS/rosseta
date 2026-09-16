// IMPORTANT: mock.module must run before any adapter import
import { resetBrowserMock, seedStore } from '../../../../tests/browser-mock';
import { describe, test, expect, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { BrowserUserPreferencesStorageAdapter } from './BrowserUserPreferencesStorageAdapter';
import { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import { ErrorCode } from '../../../shared/errors/ErrorCode';

// ── Helpers ──────────────────────────────────────────────────────────

function validPreferencesProps(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prefs-1',
    theme: 'dark',
    targetLanguage: 'en-US',
    selectedModels: { google: 'gemini-2.5-flash' },
    ...overrides,
  };
}

// Cast for mock method access
const storage = browser.storage.local as unknown as {
  get: ReturnType<typeof import('bun:test').mock>;
  set: ReturnType<typeof import('bun:test').mock>;
  remove: ReturnType<typeof import('bun:test').mock>;
};

// ── Tests ────────────────────────────────────────────────────────────

describe('Adapter: BrowserUserPreferencesStorageAdapter', () => {
  const adapter = new BrowserUserPreferencesStorageAdapter();

  beforeEach(() => resetBrowserMock());

  // ── get ─────────────────────────────────────────────────────────
  test('get() returns null when storage is empty', async () => {
    const result = await adapter.get();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  test('get() reconstructs UserPreferences from valid stored props', async () => {
    seedStore({ userPreferences: validPreferencesProps() });

    const result = await adapter.get();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data).toBeInstanceOf(UserPreferences);
      expect(result.data?.theme.value).toBe('dark');
      expect(result.data?.getModelIdFor('google')).toBe('gemini-2.5-flash');
    }
  });

  test('get() reads a stored includeDescription flag', async () => {
    seedStore({
      userPreferences: validPreferencesProps({
        includeDescription: false,
      }),
    });

    const result = await adapter.get();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.includeDescription).toBe(false);
    }
  });

  test('get() ignores legacy selectedModel instead of migrating it', async () => {
    seedStore({
      userPreferences: {
        id: 'prefs-1',
        targetLanguage: 'fr-FR',
        selectedModel: 'gemini-2.5-flash',
      },
    });

    const result = await adapter.get();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.selectedModels).toEqual({});
      expect(result.data?.targetLanguage.code).toBe('fr-FR');
    }
  });

  test('get() cleans up invalid data and returns null', async () => {
    seedStore({ userPreferences: { id: 'p1', theme: 'rainbow' } });

    const result = await adapter.get();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  test('get() returns StorageError on read failure', async () => {
    storage.get.mockImplementationOnce(async () => {
      throw new Error('read fail');
    });

    const result = await adapter.get();
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
  });

  // ── set ─────────────────────────────────────────────────────────
  test('set() merges partial preferences with existing', async () => {
    seedStore({ userPreferences: validPreferencesProps() });

    const result = await adapter.set({ theme: 'light' });
    expect(result.success).toBe(true);

    const getResult = await adapter.get();
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data?.theme.value).toBe('light');
      expect(getResult.data?.getModelIdFor('google')).toBe('gemini-2.5-flash');
    }
  });

  test('set() persists per-provider model selections', async () => {
    const result = await adapter.set({
      selectedModels: { groq: 'llama-4', xai: 'grok-3' },
    });
    expect(result.success).toBe(true);

    const getResult = await adapter.get();
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data?.getModelIdFor('groq')).toBe('llama-4');
      expect(getResult.data?.getModelIdFor('xai')).toBe('grok-3');
      expect(getResult.data?.getModelIdFor('google')).toBe('gemini-2.5-flash');
    }
  });

  test('set() persists target language changes', async () => {
    await adapter.set({ targetLanguage: 'ja-JP' });

    const getResult = await adapter.get();
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data?.targetLanguage.code).toBe('ja-JP');
    }
  });

  test('set() persists includeDescription changes', async () => {
    await adapter.set({ includeDescription: false });

    const getResult = await adapter.get();
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data?.includeDescription).toBe(false);
    }
  });

  test('set() creates preferences when nothing exists', async () => {
    const result = await adapter.set({ theme: 'dark' });
    expect(result.success).toBe(true);

    const getResult = await adapter.get();
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data).not.toBeNull();
      expect(getResult.data?.theme.value).toBe('dark');
    }
  });

  test('set() returns StorageError on write failure', async () => {
    storage.set.mockImplementationOnce(async () => {
      throw new Error('write fail');
    });

    const result = await adapter.set({ theme: 'dark' });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
  });

  // ── clear ───────────────────────────────────────────────────────
  test('clear() removes preferences', async () => {
    seedStore({ userPreferences: validPreferencesProps() });

    const result = await adapter.clear();
    expect(result.success).toBe(true);

    const getResult = await adapter.get();
    expect(getResult.success).toBe(true);
    if (getResult.success) expect(getResult.data).toBeNull();
  });

  test('clear() returns StorageError on failure', async () => {
    storage.remove.mockImplementationOnce(async () => {
      throw new Error('remove fail');
    });

    const result = await adapter.clear();
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
  });
});
