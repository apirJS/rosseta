import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Translation } from '../../../../../../core/domain/translation/Translation';
import { TextSegment } from '../../../../../../core/domain/translation/TextSegment';
import { Language } from '../../../../../../core/domain/translation/Language';
import { ErrorCode } from '../../../../../../shared/errors/ErrorCode';
import { AppError } from '../../../../../../shared/errors/AppError';
import type { IGetAllTranslationsUseCase } from '../../../../../../core/ports/inbound/history/IGetAllTranslationsUseCase';
import type { IDeleteTranslationUseCase } from '../../../../../../core/ports/inbound/history/IDeleteTranslationUseCase';
import {
  createHistoryController,
  type HistoryDeps,
} from './HistoryController.svelte';
import { success, failure } from '../../../../../../shared/types/Result';

const mockGetAllTranslations: IGetAllTranslationsUseCase = {
  execute: vi.fn(),
};

const mockDeleteTranslation: IDeleteTranslationUseCase = {
  execute: vi.fn(),
};

const deps: HistoryDeps = {
  load: () => mockGetAllTranslations.execute(),
  remove: (id) => mockDeleteTranslation.execute(id),
  open: vi.fn().mockResolvedValue(undefined),
};

function makeSegment(text: string, langCode: 'ja-JP' | 'en-US'): TextSegment {
  const lang = Language.create(langCode);
  const result = TextSegment.create(text, lang);

  if (!result.success) throw new Error('Failed to create TextSegment');

  return result.data;
}

function makeTranslation(
  id: string,
  originalText: string,
  createdAt: Date = new Date(),
): Translation {
  return Translation.create(
    id,
    [makeSegment(originalText, 'ja-JP')],
    [makeSegment('Translated', 'en-US')],
    'A test translation',
    createdAt,
  );
}

describe('UI Controller: HistoryController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    vi.mocked(mockDeleteTranslation.execute).mockResolvedValue(
      success(undefined),
    );
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test('initial state has empty arrays and no search/filter', () => {
    const controller = createHistoryController(deps);

    expect(controller.state.translations).toEqual([]);
    expect(controller.state.searchQuery).toBe('');
    expect(controller.state.timeFilter).toBe('all');
    expect(controller.state.loading).toBe(false);
    expect(controller.state.error).toBeNull();
  });

  test('load() sets loading=true, then populates translations on success', async () => {
    const items = [
      makeTranslation('t-1', 'ã“ã‚“ã«ã¡ã¯'),
      makeTranslation('t-2', 'ä¸–ç•Œ'),
    ];

    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: items,
    });

    const controller = createHistoryController(deps);

    await controller.load();

    expect(controller.state.loading).toBe(false);
    expect(controller.state.error).toBeNull();
    expect(controller.state.translations).toHaveLength(2);
  });

  test('load() sets error on failure', async () => {
    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: false,
      error: new AppError({ code: ErrorCode.STORAGE_READ_FAILED }),
    });

    const controller = createHistoryController(deps);

    await controller.load();

    expect(controller.state.loading).toBe(false);
    expect(controller.state.error).toBe('Failed to load history');
    expect(controller.state.translations).toEqual([]);
  });

  test('setSearchQuery updates state and filters by original text', async () => {
    const items = [
      makeTranslation('t-1', 'ã“ã‚“ã«ã¡ã¯'),
      makeTranslation('t-2', 'ä¸–ç•Œ'),
    ];

    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: items,
    });

    const controller = createHistoryController(deps);

    await controller.load();

    controller.setSearchQuery('ã“ã‚“ã«ã¡ã¯');
    expect(controller.state.searchQuery).toBe('ã“ã‚“ã«ã¡ã¯');
    expect(controller.items).toHaveLength(1);
    expect(controller.items[0].id).toBe('t-1');
  });

  test('setSearchQuery returns all items when cleared', async () => {
    const items = [
      makeTranslation('t-1', 'hello'),
      makeTranslation('t-2', 'world'),
    ];

    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: items,
    });

    const controller = createHistoryController(deps);

    await controller.load();

    controller.setSearchQuery('hello');
    expect(controller.items).toHaveLength(1);

    controller.setSearchQuery('');
    expect(controller.items).toHaveLength(2);
  });

  test('setTimeFilter "24h" excludes older translations', async () => {
    const recent = makeTranslation('t-1', 'Recent', new Date());

    const old = makeTranslation(
      't-2',
      'Old',
      new Date(Date.now() - 48 * 60 * 60 * 1000),
    );

    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: [recent, old],
    });

    const controller = createHistoryController(deps);

    await controller.load();

    controller.setTimeFilter('24h');
    expect(controller.state.timeFilter).toBe('24h');
    expect(controller.items).toHaveLength(1);
    expect(controller.items[0].id).toBe('t-1');
  });

  test('setTimeFilter "7d" excludes translations older than 7 days', async () => {
    const recent = makeTranslation('t-1', 'Recent', new Date());

    const old = makeTranslation(
      't-2',
      'Old',
      new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    );

    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: [recent, old],
    });

    const controller = createHistoryController(deps);

    await controller.load();

    controller.setTimeFilter('7d');
    expect(controller.items).toHaveLength(1);
    expect(controller.items[0].id).toBe('t-1');
  });

  test('setTimeFilter "all" includes everything', async () => {
    const recent = makeTranslation('t-1', 'Recent', new Date());
    const old = makeTranslation('t-2', 'Old', new Date('2020-01-01'));

    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: [recent, old],
    });

    const controller = createHistoryController(deps);

    await controller.load();

    controller.setTimeFilter('all');
    expect(controller.items).toHaveLength(2);
  });

  test('search + time filter combine correctly', async () => {
    const recentMatch = makeTranslation('t-1', 'hello', new Date());
    const recentNoMatch = makeTranslation('t-2', 'world', new Date());

    const oldMatch = makeTranslation(
      't-3',
      'hello',
      new Date(Date.now() - 48 * 60 * 60 * 1000),
    );

    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: [recentMatch, recentNoMatch, oldMatch],
    });

    const controller = createHistoryController(deps);

    await controller.load();

    controller.setTimeFilter('24h');
    controller.setSearchQuery('hello');

    expect(controller.items).toHaveLength(1);
    expect(controller.items[0].id).toBe('t-1');
  });

  test('deleteItem removes translation from state immediately (pending undo)', async () => {
    const items = [
      makeTranslation('t-1', 'keep'),
      makeTranslation('t-2', 'delete'),
    ];

    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: items,
    });

    const controller = createHistoryController(deps);

    await controller.load();
    expect(controller.state.translations).toHaveLength(2);

    controller.deleteItem('t-2');

    expect(controller.state.translations).toHaveLength(1);
    expect(controller.state.translations[0].id).toBe('t-1');
    expect(controller.state.pendingDeleteId).not.toBeNull();
    expect(controller.state.pendingDeleteId).toBe('t-2');
    expect(mockDeleteTranslation.execute).not.toHaveBeenCalled();
  });

  test('undoDelete restores the deleted translation', async () => {
    const items = [
      makeTranslation('t-1', 'keep'),
      makeTranslation('t-2', 'to-undo'),
    ];

    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: items,
    });

    const controller = createHistoryController(deps);

    await controller.load();

    controller.deleteItem('t-2');
    expect(controller.state.translations).toHaveLength(1);

    controller.undoDelete();
    expect(controller.state.translations).toHaveLength(2);
    expect(controller.state.pendingDeleteId).toBeNull();
  });

  test('openItem delegates the saved translation to the page', async () => {
    const t = makeTranslation('t-1', 'hello');

    const controller = createHistoryController(deps);

    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue(success([t]));
    await controller.load();
    await controller.openItem('t-1');

    expect(deps.open).toHaveBeenCalledWith(t);
  });

  test('prepares display text and a local date for the dumb history item', async () => {
    const item = Translation.create(
      't-1',
      [makeSegment('Hello', 'en-US'), makeSegment('world', 'en-US')],
      [makeSegment('Translated', 'en-US')],
      '',
      new Date(2026, 0, 2, 3, 4),
    );

    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue(
      success([item]),
    );

    const controller = createHistoryController(deps);

    await controller.load();

    expect(controller.items).toEqual([
      { id: 't-1', previewText: 'Hello world', formattedDate: '01-02 03:04' },
    ]);
  });

  test('search ignores surrounding whitespace and matches translated text', async () => {
    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue(
      success([makeTranslation('t-1', 'source')]),
    );

    const controller = createHistoryController(deps);

    await controller.load();
    controller.setSearchQuery(' TRANSLATED ');

    expect(controller.items.map((item) => item.id)).toEqual(['t-1']);
  });

  test('a second delete commits the first and Undo restores only the latest', async () => {
    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue(
      success([
        makeTranslation('t-1', 'first'),
        makeTranslation('t-2', 'second'),
      ]),
    );

    const controller = createHistoryController(deps);

    await controller.load();
    controller.deleteItem('t-1');
    controller.deleteItem('t-2');
    controller.undoDelete();
    await vi.advanceTimersByTimeAsync(5000);

    expect(mockDeleteTranslation.execute).toHaveBeenCalledExactlyOnceWith(
      't-1',
    );

    expect(controller.items.map((item) => item.id)).toEqual(['t-2']);
    expect(controller.state.pendingDeleteId).toBeNull();
  });

  test('commits a pending delete after five seconds', async () => {
    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue(
      success([makeTranslation('t-1', 'source')]),
    );

    const controller = createHistoryController(deps);

    await controller.load();
    controller.deleteItem('t-1');
    await vi.advanceTimersByTimeAsync(4999);
    expect(mockDeleteTranslation.execute).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(mockDeleteTranslation.execute).toHaveBeenCalledExactlyOnceWith(
      't-1',
    );

    expect(controller.state.pendingDeleteId).toBeNull();
  });

  test('leaving the page commits the pending delete and clears its timer', async () => {
    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue(
      success([makeTranslation('t-1', 'source')]),
    );

    const controller = createHistoryController(deps);

    await controller.load();
    controller.deleteItem('t-1');
    controller.destroy();
    await vi.advanceTimersByTimeAsync(5000);

    expect(mockDeleteTranslation.execute).toHaveBeenCalledExactlyOnceWith(
      't-1',
    );

    expect(controller.state.pendingDeleteId).toBeNull();
  });

  test('restores an item and exposes the failure when deletion is rejected', async () => {
    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue(
      success([makeTranslation('t-1', 'source')]),
    );

    vi.mocked(mockDeleteTranslation.execute).mockResolvedValue(
      failure(new AppError({ code: ErrorCode.STORAGE_WRITE_FAILED })),
    );

    const controller = createHistoryController(deps);

    await controller.load();
    controller.deleteItem('t-1');
    await vi.advanceTimersByTimeAsync(5000);

    expect(controller.items.map((item) => item.id)).toEqual(['t-1']);
    expect(controller.state.error).toBe('Failed to delete translation');
  });
});
