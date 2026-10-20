// IMPORTANT: mock.module must run before any adapter import
import { resetBrowserMock, seedStore } from '../../../../../tests/browser-mock';
import { describe, test, expect, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { BrowserTranslationStorageAdapter } from './BrowserTranslationStorageAdapter';
import { Translation } from '../../../../core/domain/translation/Translation';
import { TextSegment } from '../../../../core/domain/translation/TextSegment';
import { Language } from '../../../../core/domain/translation/Language';
import { ErrorCode } from '../../../../shared/errors/ErrorCode';

const NOW = Date.parse('2026-10-20T12:00:00.000Z');
const RETENTION_CUTOFF = NOW - 90 * 24 * 60 * 60 * 1000;

function createAdapter() {
  return new BrowserTranslationStorageAdapter(() => NOW);
}

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

  return Translation.create(
    id,
    [origSeg.data],
    [transSeg.data],
    'greeting',
    new Date(NOW),
  );
}

function validTranslationProps(
  id: string = 'trans-1',
  createdAt: Date = new Date(NOW),
) {
  return {
    id,
    original: [
      {
        text: 'こんにちは',
        languageCode: 'ja-JP',
        languageName: 'Japanese',
        romanization: 'konnichiwa',
        blockIndex: 0,
      },
    ],
    translated: [
      {
        text: 'Hello',
        languageCode: 'en-US',
        languageName: 'English',
        romanization: null,
        blockIndex: 0,
      },
    ],
    description: 'greeting',
    createdAt: createdAt.toISOString(),
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
  const adapter = createAdapter();

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

  test('parallel final saves across adapter instances preserve both translations', async () => {
    seedStore({ translations: [validTranslationProps('existing')] });

    const results = await Promise.all([
      adapter.save(createTranslation('first')),
      createAdapter().save(createTranslation('second')),
    ]);

    expect(results.every((result) => result.success)).toBe(true);

    const all = await adapter.getAll();

    expect(
      all.success && all.data.map((translation) => translation.id),
    ).toEqual(['second', 'first', 'existing']);
  });

  test('a failed final write does not block the next concurrent commit', async () => {
    storage.set.mockRejectedValueOnce(new Error('quota'));

    const [failed, succeeded] = await Promise.all([
      adapter.save(createTranslation('failed')),
      createAdapter().save(createTranslation('saved')),
    ]);

    expect(failed.success).toBe(false);
    expect(succeeded.success).toBe(true);

    const all = await adapter.getAll();

    expect(
      all.success && all.data.map((translation) => translation.id),
    ).toEqual(['saved']);
  });

  test('serializes deletion with final commits instead of restoring a deleted record', async () => {
    seedStore({ translations: [validTranslationProps('remove')] });

    const results = await Promise.all([
      adapter.delete('remove'),
      createAdapter().save(createTranslation('new')),
    ]);

    expect(results.every((result) => result.success)).toBe(true);

    const all = await adapter.getAll();

    expect(
      all.success && all.data.map((translation) => translation.id),
    ).toEqual(['new']);
  });

  test('backup replacement preserves the existing final history shape', async () => {
    const translation = createTranslation('restored');

    expect((await adapter.replaceAll([translation])).success).toBe(true);

    const raw = await browser.storage.local.get('translations');

    expect(raw.translations).toEqual([translation.toProps()]);

    const loaded = await createAdapter().getById('restored');

    expect(loaded.success && loaded.data?.toProps()).toEqual(
      translation.toProps(),
    );
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

  test('getAll() physically deletes expired records and retains the exact 90-day boundary', async () => {
    const boundary = validTranslationProps(
      'boundary',
      new Date(RETENTION_CUTOFF),
    );

    const recent = validTranslationProps('recent');

    seedStore({
      translations: [
        validTranslationProps('expired', new Date(RETENTION_CUTOFF - 1)),
        boundary,
        recent,
      ],
    });

    const result = await adapter.getAll();

    expect(result.success && result.data.map((item) => item.id)).toEqual([
      'boundary',
      'recent',
    ]);

    expect(
      (await browser.storage.local.get('translations')).translations,
    ).toEqual([boundary, recent]);
  });

  test('getById() expires records and returns null instead of exposing old history', async () => {
    seedStore({
      translations: [
        validTranslationProps('expired', new Date(RETENTION_CUTOFF - 1)),
      ],
    });

    const result = await adapter.getById('expired');

    expect(result.success && result.data).toBeNull();

    expect(
      (await browser.storage.local.get('translations')).translations,
    ).toEqual([]);
  });

  test('reading recent or empty history does not rewrite storage', async () => {
    await adapter.getAll();
    seedStore({ translations: [validTranslationProps()] });
    await adapter.getAll();
    await adapter.getById('trans-1');

    expect(storage.set).not.toHaveBeenCalled();
  });

  test('save() removes old history in the same commit as the new translation', async () => {
    const recent = validTranslationProps('recent');

    seedStore({
      translations: [
        validTranslationProps('expired', new Date(RETENTION_CUTOFF - 1)),
        recent,
      ],
    });

    const current = createTranslation('current');

    expect((await adapter.save(current)).success).toBe(true);

    expect(
      (await browser.storage.local.get('translations')).translations,
    ).toEqual([current.toProps(), recent]);

    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  test('save() does not persist a translation that is already older than 90 days', async () => {
    const expired = Translation.create(
      'expired',
      [],
      [],
      '',
      new Date(RETENTION_CUTOFF - 1),
    );

    expect((await adapter.save(expired)).success).toBe(true);

    expect(
      (await browser.storage.local.get('translations')).translations,
    ).toEqual([]);
  });

  test('backup replacement drops expired history immediately', async () => {
    const expired = Translation.create(
      'expired',
      [],
      [],
      '',
      new Date(RETENTION_CUTOFF - 1),
    );

    const recent = createTranslation('recent');

    expect((await adapter.replaceAll([expired, recent])).success).toBe(true);

    expect(
      (await browser.storage.local.get('translations')).translations,
    ).toEqual([recent.toProps()]);
  });

  test('delete() also prunes expired records when removing a different item', async () => {
    seedStore({
      translations: [
        validTranslationProps('expired', new Date(RETENTION_CUTOFF - 1)),
        validTranslationProps('remove'),
        validTranslationProps('keep'),
      ],
    });

    expect((await adapter.delete('remove')).success).toBe(true);

    expect(
      (await browser.storage.local.get('translations')).translations,
    ).toEqual([validTranslationProps('keep')]);
  });

  test('invalid dates are discarded during retention cleanup', async () => {
    seedStore({
      translations: [
        { ...validTranslationProps('invalid'), createdAt: 'not a date' },
      ],
    });

    const result = await adapter.getAll();

    expect(result.success && result.data).toEqual([]);

    expect(
      (await browser.storage.local.get('translations')).translations,
    ).toEqual([]);
  });

  test('cleanup reports a write failure and retries on the next access', async () => {
    const expired = validTranslationProps(
      'expired',
      new Date(RETENTION_CUTOFF - 1),
    );

    seedStore({ translations: [expired] });
    storage.set.mockRejectedValueOnce(new Error('quota'));

    const failed = await adapter.getAll();

    expect(failed.success).toBe(false);
    if (!failed.success)
      expect(failed.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);

    expect(
      (await browser.storage.local.get('translations')).translations,
    ).toEqual([expired]);

    const retried = await adapter.getAll();

    expect(retried.success && retried.data).toEqual([]);

    expect(
      (await browser.storage.local.get('translations')).translations,
    ).toEqual([]);
  });

  test('cleanup and concurrent final saves preserve every recent translation', async () => {
    seedStore({
      translations: [
        validTranslationProps('expired', new Date(RETENTION_CUTOFF - 1)),
        validTranslationProps('existing'),
      ],
    });

    const results = await Promise.all([
      adapter.getAll(),
      createAdapter().save(createTranslation('first')),
      createAdapter().getById('existing'),
      createAdapter().save(createTranslation('second')),
    ]);

    expect(results.every((result) => result.success)).toBe(true);

    const result = await adapter.getAll();

    expect(result.success && result.data.map((item) => item.id)).toEqual([
      'second',
      'first',
      'existing',
    ]);
  });

  test('a failed cleanup does not prevent the next save from pruning and committing', async () => {
    seedStore({
      translations: [
        validTranslationProps('expired', new Date(RETENTION_CUTOFF - 1)),
      ],
    });

    storage.set.mockRejectedValueOnce(new Error('quota'));

    const [cleanup, save] = await Promise.all([
      adapter.getAll(),
      createAdapter().save(createTranslation('saved')),
    ]);

    expect(cleanup.success).toBe(false);
    expect(save.success).toBe(true);

    expect(
      (await browser.storage.local.get('translations')).translations,
    ).toEqual([createTranslation('saved').toProps()]);
  });

  test('lock acquisition failure returns a StorageError without reading or rewriting history', async () => {
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    );

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        locks: {
          request: async () => {
            throw new Error('lock unavailable');
          },
        },
      },
    });

    try {
      const result = await adapter.getAll();

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
      }

      expect(storage.get).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    } finally {
      if (navigatorDescriptor) {
        Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'navigator');
      }
    }
  });
});
