import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  TranslationModalController,
  type SegmentPayload,
} from './TranslationModalController.svelte';

// ── Helpers ──────────────────────────────────────────────────────

function makeSegments(
  items: {
    code: string;
    name: string;
    text: string;
    romanization?: string | null;
    blockIndex?: number;
  }[],
): SegmentPayload[] {
  return items.map((i) => ({
    language: { code: i.code, name: i.name },
    text: i.text,
    romanization: i.romanization ?? null,
    blockIndex: i.blockIndex ?? 0,
  }));
}

function createController(overrides?: {
  original?: SegmentPayload[];
  translated?: SegmentPayload[];
  description?: string;
  detachModal?: () => void;
}): TranslationModalController {
  return new TranslationModalController({
    original:
      overrides?.original ??
      makeSegments([
        {
          code: 'ja-JP',
          name: 'Japanese',
          text: 'こんにちは',
          romanization: 'konnichiwa',
        },
      ]),
    translated:
      overrides?.translated ??
      makeSegments([{ code: 'en-US', name: 'English', text: 'Hello' }]),
    description: overrides?.description ?? 'A greeting',
    detachModal: overrides?.detachModal ?? vi.fn(),
  });
}

// ── Tests ────────────────────────────────────────────────────────

describe('UI Controller: TranslationModalController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Initial state ──────────────────────────────────────────

  test('initial position is (0, 0)', () => {
    const ctrl = createController();

    expect(ctrl.posX).toBe(0);
    expect(ctrl.posY).toBe(0);
  });

  test('initial copy states are all idle', () => {
    const ctrl = createController();

    expect(ctrl.originalCopy).toBe('idle');
    expect(ctrl.translatedCopy).toBe('idle');
    expect(ctrl.descriptionCopy).toBe('idle');
  });

  // ── Derived text ───────────────────────────────────────────

  test('originalText joins all original segment texts', () => {
    const ctrl = createController({
      original: makeSegments([
        { code: 'ja-JP', name: 'Japanese', text: 'こんにちは' },
        { code: 'ja-JP', name: 'Japanese', text: '世界' },
      ]),
    });

    expect(ctrl.originalText).toBe('こんにちは 世界');
  });

  test('translatedText joins all translated segment texts', () => {
    const ctrl = createController({
      translated: makeSegments([
        { code: 'en-US', name: 'English', text: 'Hello' },
        { code: 'en-US', name: 'English', text: 'World' },
      ]),
    });

    expect(ctrl.translatedText).toBe('Hello World');
  });

  // ── Block grouping ─────────────────────────────────────────

  test('originalText joins segments in the same block with a space', () => {
    const ctrl = createController({
      original: makeSegments([
        { code: 'en-US', name: 'English', text: 'OK', blockIndex: 0 },
        { code: 'ja-JP', name: 'Japanese', text: 'ボタン', blockIndex: 0 },
      ]),
    });

    expect(ctrl.originalText).toBe('OK ボタン');
  });

  test('originalText separates distinct blocks with a newline', () => {
    const ctrl = createController({
      original: makeSegments([
        { code: 'ja-JP', name: 'Japanese', text: 'こんにちは', blockIndex: 0 },
        { code: 'ja-JP', name: 'Japanese', text: '世界', blockIndex: 1 },
      ]),
    });

    expect(ctrl.originalText).toBe('こんにちは\n世界');
  });

  test('originalBlocks groups consecutive segments sharing a blockIndex', () => {
    const ctrl = createController({
      original: makeSegments([
        { code: 'en-US', name: 'English', text: 'OK', blockIndex: 0 },
        { code: 'ja-JP', name: 'Japanese', text: 'ボタン', blockIndex: 0 },
        { code: 'number', name: 'Number', text: '3.50', blockIndex: 1 },
      ]),
    });

    expect(ctrl.originalBlocks).toHaveLength(2);
    expect(ctrl.originalBlocks[0].map((s) => s.text)).toEqual([
      'OK',
      'ボタン',
    ]);
    expect(ctrl.originalBlocks[0].map((s) => s.index)).toEqual([0, 1]);
    expect(ctrl.originalBlocks[1].map((s) => s.text)).toEqual(['3.50']);
    expect(ctrl.originalBlocks[1][0].index).toBe(2);
  });

  test('translatedBlocks groups translated segments', () => {
    const ctrl = createController({
      translated: makeSegments([
        { code: 'en-US', name: 'English', text: 'Hello', blockIndex: 0 },
        { code: 'en-US', name: 'English', text: 'World', blockIndex: 2 },
      ]),
    });

    expect(ctrl.translatedBlocks).toHaveLength(2);
    expect(ctrl.translatedText).toBe('Hello\nWorld');
  });

  // ── Romanization detection ─────────────────────────────────

  test('originalHasRomanization is true when any segment has romanization', () => {
    const ctrl = createController({
      original: makeSegments([
        {
          code: 'ja-JP',
          name: 'Japanese',
          text: 'テスト',
          romanization: 'tesuto',
        },
        { code: 'ja-JP', name: 'Japanese', text: '123' },
      ]),
    });

    expect(ctrl.originalHasRomanization).toBe(true);
  });

  test('originalHasRomanization is false when no segment has romanization', () => {
    const ctrl = createController({
      original: makeSegments([
        { code: 'en-US', name: 'English', text: 'Hello' },
      ]),
    });

    expect(ctrl.originalHasRomanization).toBe(false);
  });

  test('translatedHasRomanization reflects translated segments', () => {
    const ctrl = createController({
      translated: makeSegments([
        {
          code: 'ja-JP',
          name: 'Japanese',
          text: 'テスト',
          romanization: 'tesuto',
        },
      ]),
    });

    expect(ctrl.translatedHasRomanization).toBe(true);
  });

  // ── Language detection labels ──────────────────────────────

  test('detectedLanguageLabel shows single language with code', () => {
    const ctrl = createController({
      original: makeSegments([
        { code: 'ja-JP', name: 'Japanese', text: 'テスト' },
      ]),
    });

    expect(ctrl.detectedLanguageLabel).toBe('Japanese (ja-JP)');
  });

  test('detectedLanguageLabel shows "Mixed" for multi-language', () => {
    const ctrl = createController({
      original: makeSegments([
        { code: 'ja-JP', name: 'Japanese', text: 'テスト' },
        { code: 'ko-KR', name: 'Korean', text: '테스트' },
      ]),
    });

    expect(ctrl.detectedLanguageLabel).toBe('Mixed');
  });

  test('detectedLanguageLabel ignores non-language codes (number, symbol)', () => {
    const ctrl = createController({
      original: makeSegments([
        { code: 'number', name: 'Number', text: '123' },
        { code: 'ja-JP', name: 'Japanese', text: 'テスト' },
      ]),
    });

    expect(ctrl.detectedLanguageLabel).toBe('Japanese (ja-JP)');
  });

  test('isMultiLang is true when multiple real languages detected', () => {
    const ctrl = createController({
      original: makeSegments([
        { code: 'ja-JP', name: 'Japanese', text: 'テスト' },
        { code: 'en-US', name: 'English', text: 'Hello' },
      ]),
    });

    expect(ctrl.isMultiLang).toBe(true);
  });

  test('isMultiLang is false with one real language + non-lang codes', () => {
    const ctrl = createController({
      original: makeSegments([
        { code: 'ja-JP', name: 'Japanese', text: 'テスト' },
        { code: 'number', name: 'Number', text: '42' },
        { code: 'symbol', name: 'Symbol', text: '!' },
      ]),
    });

    expect(ctrl.isMultiLang).toBe(false);
  });

  // ── targetLanguageLabel ────────────────────────────────────

  test('targetLanguageLabel shows first translated segment language', () => {
    const ctrl = createController({
      translated: makeSegments([
        { code: 'id-ID', name: 'Indonesian', text: 'Halo' },
      ]),
    });

    expect(ctrl.targetLanguageLabel).toBe('Indonesian (id-ID)');
  });

  test('targetLanguageLabel returns empty string when no translations', () => {
    const ctrl = createController({ translated: [] });

    expect(ctrl.targetLanguageLabel).toBe('');
  });

  // ── Copy methods ───────────────────────────────────────────

  test('copyOriginal sets originalCopy to "copied", resets after 2s', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const ctrl = createController();

    await ctrl.copyOriginal();
    expect(ctrl.originalCopy).toBe('copied');
    expect(writeTextMock).toHaveBeenCalledWith('こんにちは');

    vi.advanceTimersByTime(2000);
    expect(ctrl.originalCopy).toBe('idle');
  });

  test('copyTranslated sets translatedCopy to "copied"', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const ctrl = createController();

    await ctrl.copyTranslated();
    expect(ctrl.translatedCopy).toBe('copied');
    expect(writeTextMock).toHaveBeenCalledWith('Hello');
  });

  test('copyDescription sets descriptionCopy to "copied"', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const ctrl = createController({ description: 'Test desc' });

    await ctrl.copyDescription();
    expect(ctrl.descriptionCopy).toBe('copied');
    expect(writeTextMock).toHaveBeenCalledWith('Test desc');
  });

  // ── Close ──────────────────────────────────────────────────

  test('close() calls detachModal', () => {
    const detachMock = vi.fn();
    const ctrl = createController({ detachModal: detachMock });

    ctrl.close();

    expect(detachMock).toHaveBeenCalled();
  });

  // ── langColorMap ───────────────────────────────────────────

  test('langColorMap assigns consistent indices per language code', () => {
    const ctrl = createController({
      original: makeSegments([
        { code: 'ja-JP', name: 'Japanese', text: 'テスト' },
        { code: 'en-US', name: 'English', text: 'Hello' },
        { code: 'ja-JP', name: 'Japanese', text: '世界' }, // duplicate code
      ]),
    });

    expect(ctrl.langColorMap.get('ja-JP')).toBe(0);
    expect(ctrl.langColorMap.get('en-US')).toBe(1);
    expect(ctrl.langColorMap.size).toBe(2); // no duplicate
  });
});
