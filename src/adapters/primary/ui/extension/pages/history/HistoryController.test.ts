import { describe, expect, test, vi, beforeEach } from 'vitest';
import { Translation } from '../../../../../../core/domain/translation/Translation';
import { TextSegment } from '../../../../../../core/domain/translation/TextSegment';
import { Language } from '../../../../../../core/domain/translation/Language';
import { ErrorCode } from '../../../../../../shared/errors/ErrorCode';
import { AppError } from '../../../../../../shared/errors/AppError';
import type { IGetAllTranslationsUseCase } from '../../../../../../core/ports/inbound/translation/IGetAllTranslationsUseCase';
import type { IDeleteTranslationUseCase } from '../../../../../../core/ports/inbound/translation/IDeleteTranslationUseCase';

// ── Mocks ────────────────────────────────────────────────────────

const mockGetAllTranslations: IGetAllTranslationsUseCase = {
  execute: vi.fn(),
};

const mockDeleteTranslation: IDeleteTranslationUseCase = {
  execute: vi.fn(),
};

vi.mock('../../../shared/context', () => ({
  getTranslationContext: () => ({
    getAllTranslations: mockGetAllTranslations,
    deleteTranslation: mockDeleteTranslation,
  }),
}));

vi.mock('../../../../../../shared/messaging', () => ({
  sendMessageToRuntime: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../content/handlers/TranslationModalHandler', () => ({
  serializeForModal: vi.fn((t: Translation) => ({
    id: t.id,
    original: t.original.map((s) => ({
      language: { code: s.language.code, name: s.language.name },
      text: s.text,
      romanization: s.romanization,
    })),
    translated: t.translated.map((s) => ({
      language: { code: s.language.code, name: s.language.name },
      text: s.text,
      romanization: s.romanization,
    })),
    description: t.description,
    createdAt: t.createdAt,
  })),
}));

import { createHistoryController } from './HistoryController.svelte';
import { sendMessageToRuntime } from '../../../../../../shared/messaging';

// ── Helpers ──────────────────────────────────────────────────────

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
  return new Translation(
    id,
    [makeSegment(originalText, 'ja-JP')],
    [makeSegment('Translated', 'en-US')],
    'A test translation',
    createdAt,
  );
}

// ── Tests ────────────────────────────────────────────────────────

describe('UI Controller: HistoryController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial State ────────────────────────────────────────────

  test('initial state has empty arrays and no search/filter', () => {
    const controller = createHistoryController();

    expect(controller.state.translations).toEqual([]);
    expect(controller.state.searchQuery).toBe('');
    expect(controller.state.timeFilter).toBe('all');
    expect(controller.state.loading).toBe(false);
    expect(controller.state.error).toBeNull();
  });

  // ── load() ───────────────────────────────────────────────────

  test('load() sets loading=true, then populates translations on success', async () => {
    const items = [
      makeTranslation('t-1', 'こんにちは'),
      makeTranslation('t-2', '世界'),
    ];
    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: items,
    });

    const controller = createHistoryController();
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

    const controller = createHistoryController();
    await controller.load();

    expect(controller.state.loading).toBe(false);
    expect(controller.state.error).toBe('Failed to load history');
    expect(controller.state.translations).toEqual([]);
  });

  // ── Filtering ────────────────────────────────────────────────

  test('setSearchQuery updates state and filters by original text', async () => {
    const items = [
      makeTranslation('t-1', 'こんにちは'),
      makeTranslation('t-2', '世界'),
    ];
    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: items,
    });

    const controller = createHistoryController();
    await controller.load();

    controller.setSearchQuery('こんにちは');
    expect(controller.state.searchQuery).toBe('こんにちは');
    expect(controller.filtered).toHaveLength(1);
    expect(controller.filtered[0].id).toBe('t-1');
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

    const controller = createHistoryController();
    await controller.load();

    controller.setSearchQuery('hello');
    expect(controller.filtered).toHaveLength(1);

    controller.setSearchQuery('');
    expect(controller.filtered).toHaveLength(2);
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

    const controller = createHistoryController();
    await controller.load();

    controller.setTimeFilter('24h');
    expect(controller.state.timeFilter).toBe('24h');
    expect(controller.filtered).toHaveLength(1);
    expect(controller.filtered[0].id).toBe('t-1');
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

    const controller = createHistoryController();
    await controller.load();

    controller.setTimeFilter('7d');
    expect(controller.filtered).toHaveLength(1);
    expect(controller.filtered[0].id).toBe('t-1');
  });

  test('setTimeFilter "all" includes everything', async () => {
    const recent = makeTranslation('t-1', 'Recent', new Date());
    const old = makeTranslation('t-2', 'Old', new Date('2020-01-01'));
    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: [recent, old],
    });

    const controller = createHistoryController();
    await controller.load();

    controller.setTimeFilter('all');
    expect(controller.filtered).toHaveLength(2);
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

    const controller = createHistoryController();
    await controller.load();

    controller.setTimeFilter('24h');
    controller.setSearchQuery('hello');

    expect(controller.filtered).toHaveLength(1);
    expect(controller.filtered[0].id).toBe('t-1');
  });

  // ── deleteItem() ──────────────────────────────────────────────

  test('deleteItem removes translation from state on success', async () => {
    const items = [
      makeTranslation('t-1', 'keep'),
      makeTranslation('t-2', 'delete'),
    ];
    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: items,
    });
    vi.mocked(mockDeleteTranslation.execute).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const controller = createHistoryController();
    await controller.load();
    expect(controller.state.translations).toHaveLength(2);

    await controller.deleteItem('t-2');

    expect(mockDeleteTranslation.execute).toHaveBeenCalledWith('t-2');
    expect(controller.state.translations).toHaveLength(1);
    expect(controller.state.translations[0].id).toBe('t-1');
  });

  test('deleteItem does not remove translation on failure', async () => {
    const items = [makeTranslation('t-1', 'keep')];
    vi.mocked(mockGetAllTranslations.execute).mockResolvedValue({
      success: true,
      data: items,
    });
    vi.mocked(mockDeleteTranslation.execute).mockResolvedValue({
      success: false,
      error: new AppError({ code: ErrorCode.STORAGE_READ_FAILED }),
    });

    const controller = createHistoryController();
    await controller.load();

    await controller.deleteItem('t-1');

    expect(controller.state.translations).toHaveLength(1);
  });

  // ── openItem() ────────────────────────────────────────────────

  test('openItem serializes and sends MOUNT_HISTORY_MODAL message', async () => {
    const t = makeTranslation('t-1', 'hello');

    const controller = createHistoryController();
    await controller.openItem(t);

    expect(sendMessageToRuntime).toHaveBeenCalledWith({
      action: 'MOUNT_HISTORY_MODAL',
      payload: expect.objectContaining({ id: 't-1' }),
    });
  });
});
