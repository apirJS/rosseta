import { describe, expect, test } from 'vitest';
import { TranslationSegmentsController } from './TranslationSegmentsController.svelte';
import type { SegmentPayload } from './translation-modal-segments';

function segment(
  text: string,
  code: string,
  index: number,
  blockIndex = 0,
  romanization: string | null = null,
): SegmentPayload {
  return {
    text,
    language: { code, name: code },
    index,
    blockIndex,
    romanization,
  };
}

describe('TranslationSegmentsController', () => {
  test('keeps source and translated block boundaries when preparing clipboard text', () => {
    const controller = new TranslationSegmentsController(() => ({
      original: [
        segment('First', 'en', 7),
        segment('line', 'en', 9),
        segment('Second', 'en', 12, 1),
      ],
      translated: [
        segment('Première', 'fr', 7),
        segment('ligne', 'fr', 9),
        segment('Deuxième', 'fr', 12, 1),
      ],
    }));

    expect(
      controller.originalBlocks.map((block) => block.map((row) => row.index)),
    ).toEqual([[7, 9], [12]]);

    expect(controller.originalText).toBe('First line\nSecond');
    expect(controller.translatedText).toBe('Première ligne\nDeuxième');
  });

  test('uses the paired source index when hovering translated text or pronunciation', () => {
    const controller = new TranslationSegmentsController(() => ({
      original: [
        segment('こんにちは', 'ja', 7, 0, 'konnichiwa'),
        segment('안녕', 'ko', 19, 1),
      ],
      translated: [segment('Hello', 'en', 7), segment('Hi', 'en', 19, 1)],
    }));

    expect(controller.displayedLangLabel).toBe('Mixed');
    controller.hoverSegment(19);
    expect(controller.displayedLangLabel).toBe('ko (ko)');
    expect(controller.highlightedSegmentIndex).toBe(19);
    expect(controller.targetLanguageLabel).toBe('en (en)');
    expect(controller.originalHasRomanization).toBe(true);
    expect(controller.translatedHasRomanization).toBe(false);
    controller.hoverSegment(null);
    expect(controller.displayedLangLabel).toBe('Mixed');
    expect(controller.highlightedSegmentIndex).toBeNull();
  });

  test.each(['number', 'symbol', 'unknown'])(
    'does not treat %s as another detected language',
    (code) => {
      const controller = new TranslationSegmentsController(() => ({
        original: [segment('Text', 'en', 2), segment('42', code, 5)],
        translated: [],
      }));

      controller.hoverSegment(5);
      expect(controller.isMultiLang).toBe(false);
      expect(controller.displayedLangLabel).toBe('en (en)');
      expect(controller.targetLanguageLabel).toBe('');
    },
  );

  test('reuses each language color and handles an empty result', () => {
    const controller = new TranslationSegmentsController(() => ({
      original: [
        segment('One', 'en', 0),
        segment('Deux', 'fr', 1),
        segment('Three', 'en', 2),
      ],
      translated: [],
    }));

    expect([...controller.langColorMap]).toEqual([
      ['en', 0],
      ['fr', 1],
    ]);

    const empty = new TranslationSegmentsController(() => ({
      original: [],
      translated: [],
    }));

    expect(empty.originalText).toBe('');
    expect(empty.detectedLanguageLabel).toBe('');
    expect(empty.originalBlocks).toEqual([]);
  });
});
