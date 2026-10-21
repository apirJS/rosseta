import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { TranslationModalController } from './TranslationModalController.svelte';
import type { SegmentPayload } from './translation-modal-segments';

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

    expect(ctrl.drag.x).toBe(0);
    expect(ctrl.drag.y).toBe(0);
  });

  test('initial copy states are all idle', () => {
    const ctrl = createController();

    expect(ctrl.clipboard.states.original).toBe('idle');
    expect(ctrl.clipboard.states.translated).toBe('idle');
    expect(ctrl.clipboard.states.description).toBe('idle');
  });

  test('completed status hides after one second and a new attempt makes status visible again', () => {
    const ctrl = createController();

    expect(ctrl.headerStatus).toBe('Complete');
    vi.advanceTimersByTime(1_000);
    expect(ctrl.headerStatus).toBe('');
    ctrl.started({ code: 'en-US', name: 'English' });
    expect(ctrl.headerStatus).toBe('Translating...');
    vi.advanceTimersByTime(1_000);
    expect(ctrl.headerStatus).toBe('Translating...');
    ctrl.dispose();
  });

  test('a failure keeps its title in the body instead of the header status', () => {
    const ctrl = createController();

    ctrl.failed({
      code: 'TRANSLATION_NO_TEXT_FOUND',
      title: 'No Text Found',
      userMessage: 'No readable text was found.',
    });

    expect(ctrl.headerStatus).toBe('');
    expect(ctrl.status).toBe('No Text Found');
    expect(ctrl.failureDescription).toBe('No readable text was found.');
    ctrl.dispose();
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
    expect(ctrl.originalBlocks[0].map((s) => s.text)).toEqual(['OK', 'ボタン']);
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

    await ctrl.copy('original');
    expect(ctrl.clipboard.states.original).toBe('copied');
    expect(writeTextMock).toHaveBeenCalledWith('こんにちは');

    vi.advanceTimersByTime(2000);
    expect(ctrl.clipboard.states.original).toBe('idle');
  });

  test('copyTranslated sets translatedCopy to "copied"', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const ctrl = createController();

    await ctrl.copy('translated');
    expect(ctrl.clipboard.states.translated).toBe('copied');
    expect(writeTextMock).toHaveBeenCalledWith('Hello');
  });

  test('copyDescription sets descriptionCopy to "copied"', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const ctrl = createController({ description: 'Test desc' });

    await ctrl.copy('description');
    expect(ctrl.clipboard.states.description).toBe('copied');
    expect(writeTextMock).toHaveBeenCalledWith('Test desc');
  });

  test('clipboard fallback copies the final text and removes its temporary textarea', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi
          .fn()
          .mockRejectedValue(new Error('Clipboard unavailable')),
      },
    });

    const execCommand = vi.fn().mockReturnValue(true);

    Object.assign(document, { execCommand });

    const ctrl = createController();

    await ctrl.copy('translated');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(ctrl.clipboard.states.translated).toBe('copied');
    expect(document.querySelector('textarea')).toBeNull();
    ctrl.dispose();
  });

  test('failed clipboard fallback removes its textarea and leaves feedback idle', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi
          .fn()
          .mockRejectedValue(new Error('Clipboard unavailable')),
      },
    });

    Object.assign(document, {
      execCommand: vi.fn(() => {
        throw new Error('Copy denied');
      }),
    });

    const ctrl = createController();

    await ctrl.copy('translated');

    expect(ctrl.clipboard.states.translated).toBe('idle');
    expect(document.querySelector('textarea')).toBeNull();
    ctrl.dispose();
  });

  test('a clipboard operation settling after disposal cannot start feedback', async () => {
    let resolveCopy: (() => void) | undefined;

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              resolveCopy = resolve;
            }),
        ),
      },
    });

    const ctrl = createController();
    const copying = ctrl.copy('translated');

    ctrl.dispose();
    resolveCopy?.();
    await copying;

    expect(ctrl.clipboard.states.translated).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
  });

  test('disposing during a drag stops further position updates', () => {
    const ctrl = createController();

    ctrl.drag.start({
      button: 0,
      clientX: 10,
      clientY: 20,
    } as PointerEvent);

    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 35, clientY: 47 }),
    );

    expect(ctrl.drag.x).toBe(25);
    expect(ctrl.drag.y).toBe(27);

    ctrl.dispose();

    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 70, clientY: 80 }),
    );

    expect(ctrl.drag.x).toBe(25);
    expect(ctrl.drag.y).toBe(27);
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

  test('live rows stay paired and preserve indexes while metadata arrives', () => {
    const ctrl = new TranslationModalController({
      original: [],
      translated: [],
      description: '',
      live: true,
      detachModal: vi.fn(),
    });

    ctrl.started({ code: 'en-US', name: 'English' });
    ctrl.reset();

    ctrl.snapshot({
      segments: [
        {
          index: 0,
          blockIndex: null,
          originalText: 'first',
          translatedText: '',
          sourceLanguageCode: null,
          romanization: null,
        },
        {
          index: 1,
          blockIndex: null,
          originalText: '',
          translatedText: 'second',
          sourceLanguageCode: '__proto__',
          romanization: null,
        },
      ],
      description: null,
    });

    expect(ctrl.original.map((row) => row.index)).toEqual([0, 1]);
    expect(ctrl.translated.map((row) => row.index)).toEqual([0, 1]);
    expect(ctrl.original[1].text).toBe('');
    expect(ctrl.original[1].language).toEqual({ code: 'unknown', name: '' });

    const originalKey = ctrl.original[1].rowKey;

    ctrl.hoverOriginalSegment(1);

    ctrl.snapshot({
      segments: [
        {
          index: 0,
          blockIndex: 0,
          originalText: 'first',
          translatedText: 'First',
          sourceLanguageCode: 'ja-JP',
          romanization: null,
        },
        {
          index: 1,
          blockIndex: 0,
          originalText: 'second',
          translatedText: 'Second',
          sourceLanguageCode: 'ko-KR',
          romanization: null,
        },
      ],
      description: null,
    });

    expect(ctrl.original[1].rowKey).toBe(originalKey);
    expect(ctrl.originalBlocks).toHaveLength(2);
    expect(ctrl.displayedLangLabel).toBe('Korean (ko-KR)');
    expect(ctrl.highlightedSegmentIndex).toBe(1);
    ctrl.reset();
    expect(ctrl.highlightedSegmentIndex).toBeNull();
    expect(ctrl.original).toEqual([]);
    ctrl.dispose();
  });

  test.each([
    'TRANSLATION_NO_TEXT_FOUND',
    'TRANSLATION_CONTENT_BLOCKED',
    'TRANSLATION_AI_REJECTED',
  ])(
    'clears provisional content for %s and keeps Copy unavailable',
    async (code) => {
      const writeText = vi.fn().mockResolvedValue(undefined);

      Object.assign(navigator, { clipboard: { writeText } });

      const ctrl = new TranslationModalController({
        original: [],
        translated: [],
        description: '',
        live: true,
        detachModal: vi.fn(),
      });

      ctrl.started({ code: 'en-US', name: 'English' });
      ctrl.reset();

      ctrl.snapshot({
        segments: [
          {
            index: 0,
            blockIndex: null,
            originalText: 'preview',
            translatedText: 'partial',
            sourceLanguageCode: null,
            romanization: null,
          },
        ],
        description: 'Draft',
      });

      await ctrl.copy('original');
      ctrl.committing();
      await ctrl.copy('translated');

      ctrl.failed({
        code,
        title: 'Cannot translate',
        userMessage: 'Try another area.',
      });

      await ctrl.copy('description');
      expect(ctrl.original).toEqual([]);
      expect(ctrl.translated).toEqual([]);
      expect(ctrl.description).toBe('');
      expect(ctrl.canCopy).toBe(false);
      expect(writeText).not.toHaveBeenCalled();
      ctrl.dispose();
    },
  );

  test('a connection failure preserves the safe preview and never enables Copy', () => {
    const ctrl = new TranslationModalController({
      original: [],
      translated: [],
      description: '',
      live: true,
      detachModal: vi.fn(),
    });

    ctrl.started({ code: 'en-US', name: 'English' });
    ctrl.reset();

    ctrl.snapshot({
      segments: [
        {
          index: 0,
          blockIndex: null,
          originalText: 'source',
          translatedText: 'partial',
          sourceLanguageCode: null,
          romanization: null,
        },
      ],
      description: null,
    });

    ctrl.failed({
      code: 'NETWORK_CONNECTION_FAILED',
      title: 'Disconnected',
      userMessage: 'Try again.',
    });

    expect(ctrl.translated[0].text).toBe('partial');
    expect(ctrl.canCopy).toBe(false);
    expect(ctrl.isBusy).toBe(false);
    ctrl.dispose();
  });

  test('disposed controllers ignore queued lifecycle updates and close only once', () => {
    const detach = vi.fn();
    const retry = vi.fn();

    const ctrl = new TranslationModalController({
      original: [],
      translated: [],
      description: '',
      live: true,
      detachModal: detach,
      onretry: retry,
    });

    ctrl.close();
    ctrl.started({ code: 'en-US', name: 'English' });
    ctrl.reset();
    ctrl.committing();
    ctrl.cancelled();

    ctrl.failed({
      code: 'NETWORK_TIMEOUT',
      title: 'Timeout',
      userMessage: 'Try again.',
    });

    ctrl.retry();
    ctrl.close();
    expect(ctrl.phase).toBe('preparing');
    expect(detach).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });
});
