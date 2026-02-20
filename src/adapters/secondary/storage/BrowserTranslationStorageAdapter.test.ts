// IMPORTANT: mock.module must run before any adapter import
import { resetBrowserMock, seedStore } from '../../../../tests/browser-mock';
import { describe, test, expect, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { BrowserTranslationStorageAdapter } from './BrowserTranslationStorageAdapter';
import { Translation } from '../../../core/domain/translation/Translation';
import { TextSegment } from '../../../core/domain/translation/TextSegment';
import { Language } from '../../../core/domain/translation/Language';
import { ErrorCode } from '../../../shared/errors/ErrorCode';

// ── Helpers ──────────────────────────────────────────────────────────

function createTranslation(
  id: string = 'trans-1',
  text: string = 'こんにちは',
) {
  const ja = Language.create('ja-JP');
  const en = Language.create('en-US');
  const origSeg = TextSegment.create(text, ja, 'konnichiwa');
  if (!origSeg.success) throw new Error('bad segment');
  const transSeg = TextSegment.create('Hello', en, null);
  if (!transSeg.success) throw new Error('bad segment');
  return new Translation(
    id,
    [origSeg.data],
    [transSeg.data],
    'greeting',
    new Date('2026-01-01'),
  );
}

function validTranslationProps(id: string = 'trans-1') {
  return {
    id,
    original: [
      {
        text: 'こんにちは',
        languageCode: 'ja-JP',
        languageName: 'Japanese',
        romanization: 'konnichiwa',
      },
    ],
    translated: [
      {
        text: 'Hello',
        languageCode: 'en-US',
        languageName: 'English',
        romanization: null,
      },
    ],
    description: 'greeting',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

// Cast for mock method access
const storage = browser.storage.local as unknown as {
  get: ReturnType<typeof import('bun:test').mock>;
  set: ReturnType<typeof import('bun:test').mock>;
  remove: ReturnType<typeof import('bun:test').mock>;
};

// ── Tests ────────────────────────────────────────────────────────────

describe('Adapter: BrowserTranslationStorageAdapter', () => {
  const adapter = new BrowserTranslationStorageAdapter();

  beforeEach(() => resetBrowserMock());

  // ── save ────────────────────────────────────────────────────────
  test('save() prepends a new translation', async () => {
    const t = createTranslation('trans-1');
    const result = await adapter.save(t);
    expect(result.success).toBe(true);

    const all = await adapter.getAll();
    expect(all.success).toBe(true);
    if (all.success) {
      expect(all.data).toHaveLength(1);
      expect(all.data[0].id).toBe('trans-1');
    }
  });

  test('save() replaces an existing translation by ID', async () => {
    seedStore({ translations: [validTranslationProps('trans-1')] });

    const updated = createTranslation('trans-1', '新しいテキスト');
    const result = await adapter.save(updated);
    expect(result.success).toBe(true);

    const all = await adapter.getAll();
    expect(all.success).toBe(true);
    if (all.success) {
      expect(all.data).toHaveLength(1);
    }
  });

  test('save() returns StorageError on write failure', async () => {
    storage.set.mockImplementationOnce(async () => {
      throw new Error('write fail');
    });

    const result = await adapter.save(createTranslation());
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
  });

  // ── getAll ──────────────────────────────────────────────────────
  test('getAll() returns empty array when storage is empty', async () => {
    const result = await adapter.getAll();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
  });

  test('getAll() reconstructs Translation[] from valid props', async () => {
    seedStore({
      translations: [
        validTranslationProps('t-1'),
        validTranslationProps('t-2'),
      ],
    });

    const result = await adapter.getAll();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toBeInstanceOf(Translation);
    }
  });

  test('getAll() silently skips corrupted entries', async () => {
    seedStore({
      translations: [
        validTranslationProps('good'),
        { id: 'bad', garbage: true },
        validTranslationProps('also-good'),
      ],
    });

    const result = await adapter.getAll();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(2);
  });

  // ── getById ─────────────────────────────────────────────────────
  test('getById() finds by ID', async () => {
    seedStore({ translations: [validTranslationProps('target')] });

    const result = await adapter.getById('target');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data?.id).toBe('target');
    }
  });

  test('getById() returns null for missing ID', async () => {
    const result = await adapter.getById('not-found');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  // ── delete ──────────────────────────────────────────────────────
  test('delete() removes translation by ID', async () => {
    seedStore({
      translations: [
        validTranslationProps('keep'),
        validTranslationProps('remove'),
      ],
    });

    const result = await adapter.delete('remove');
    expect(result.success).toBe(true);

    const all = await adapter.getAll();
    expect(all.success).toBe(true);
    if (all.success) {
      expect(all.data).toHaveLength(1);
      expect(all.data[0].id).toBe('keep');
    }
  });

  // ── clear ───────────────────────────────────────────────────────
  test('clear() removes the storage key', async () => {
    seedStore({ translations: [validTranslationProps()] });

    const result = await adapter.clear();
    expect(result.success).toBe(true);

    const all = await adapter.getAll();
    expect(all.success).toBe(true);
    if (all.success) expect(all.data).toEqual([]);
  });

  // ── error paths ─────────────────────────────────────────────────
  test('getAll() returns StorageError on read failure', async () => {
    storage.get.mockImplementationOnce(async () => {
      throw new Error('read fail');
    });

    const result = await adapter.getAll();
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
  });
});
