import { describe, expect, test } from 'bun:test';
import { Translation } from './Translation';
import { TextSegment } from './TextSegment';
import { Language } from './Language';

function makeSegment(
  text: string,
  langCode: 'ja-JP' | 'en-US',
  romanization?: string | null,
): TextSegment {
  const lang = Language.create(langCode);
  const result = TextSegment.create(text, lang, romanization);
  if (!result.success)
    throw new Error('Test helper: failed to create TextSegment');
  return result.data;
}

describe('Domain: Translation', () => {
  const now = new Date('2025-01-15T10:30:00Z');

  const originalSegments = [
    makeSegment('こんにちは', 'ja-JP', 'konnichiwa'),
    makeSegment('世界', 'ja-JP', 'sekai'),
  ];

  const translatedSegments = [
    makeSegment('Hello', 'en-US'),
    makeSegment('World', 'en-US'),
  ];

  // ==================== CONSTRUCTOR ====================
  describe('constructor', () => {
    test('creates a translation with all fields', () => {
      const t = new Translation(
        't-1',
        originalSegments,
        translatedSegments,
        'A greeting',
        now,
      );

      expect(t.id).toBe('t-1');
      expect(t.original).toHaveLength(2);
      expect(t.translated).toHaveLength(2);
      expect(t.description).toBe('A greeting');
      expect(t.createdAt).toEqual(now);
    });
  });

  // ==================== TO PROPS ====================
  describe('toProps', () => {
    test('serializes to plain props', () => {
      const t = new Translation(
        't-1',
        originalSegments,
        translatedSegments,
        'A greeting',
        now,
      );

      const props = t.toProps();

      expect(props.id).toBe('t-1');
      expect(props.description).toBe('A greeting');
      expect(props.createdAt).toBe('2025-01-15T10:30:00.000Z');

      expect(props.original).toEqual([
        {
          text: 'こんにちは',
          languageCode: 'ja-JP',
          languageName: Language.create('ja-JP').name,
          romanization: 'konnichiwa',
        },
        {
          text: '世界',
          languageCode: 'ja-JP',
          languageName: Language.create('ja-JP').name,
          romanization: 'sekai',
        },
      ]);

      expect(props.translated).toEqual([
        {
          text: 'Hello',
          languageCode: 'en-US',
          languageName: Language.create('en-US').name,
          romanization: null,
        },
        {
          text: 'World',
          languageCode: 'en-US',
          languageName: Language.create('en-US').name,
          romanization: null,
        },
      ]);
    });
  });

  // ==================== ENTITY EQUALITY ====================
  describe('equality', () => {
    test('translations with same ID are equal', () => {
      const a = new Translation(
        't-1',
        originalSegments,
        translatedSegments,
        'A',
        now,
      );
      const b = new Translation('t-1', [], [], 'B', new Date());
      expect(a.equals(b)).toBe(true);
    });

    test('translations with different IDs are not equal', () => {
      const a = new Translation(
        't-1',
        originalSegments,
        translatedSegments,
        'A',
        now,
      );
      const b = new Translation(
        't-2',
        originalSegments,
        translatedSegments,
        'A',
        now,
      );
      expect(a.equals(b)).toBe(false);
    });
  });
});
