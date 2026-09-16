import { describe, expect, test } from 'bun:test';
import {
  mapResponseToDomain,
  type TranslationData,
} from './translation-response-mapper';
import { Language } from '../../../core/domain/translation/Language';
import { ErrorCode } from '../../../shared/errors/ErrorCode';

const target = Language.create('en-US');

function segment(
  text: string,
  code: string,
  name: string,
  blockIndex: number,
  romanization: string | null = null,
) {
  return { text, languageBcp47Code: code, language: name, romanization, blockIndex };
}

function makeData(overrides: Partial<TranslationData> = {}): TranslationData {
  return {
    originalText: {
      contents: [segment('こんにちは', 'ja-JP', 'Japanese', 0, 'konnichiwa')],
    },
    translatedText: {
      contents: [segment('Hello', 'en-US', 'English', 0)],
    },
    description: 'A greeting',
    ...overrides,
  };
}

describe('Adapter: translation-response-mapper', () => {
  test('maps aligned segments to a Translation', () => {
    const result = mapResponseToDomain(makeData(), target, 'TEST');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.original[0].text).toBe('こんにちは');
      expect(result.data.original[0].blockIndex).toBe(0);
      expect(result.data.translated[0].text).toBe('Hello');
      expect(result.data.description).toBe('A greeting');
    }
  });

  test('preserves blockIndex, including shared blocks', () => {
    const data = makeData({
      originalText: {
        contents: [
          segment('OK', 'en-US', 'English', 1),
          segment('ボタン', 'ja-JP', 'Japanese', 1, 'botan'),
        ],
      },
      translatedText: {
        contents: [
          segment('OK', 'en-US', 'English', 1),
          segment('Button', 'en-US', 'English', 1),
        ],
      },
    });

    const result = mapResponseToDomain(data, target, 'TEST');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.original.map((s) => s.blockIndex)).toEqual([1, 1]);
    }
  });

  test('fails when original and translated segment counts differ', () => {
    const data = makeData({ translatedText: { contents: [] } });

    const result = mapResponseToDomain(data, target, 'TEST');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_MALFORMED_RESPONSE);
    }
  });

  test('normalizes a missing description to an empty string', () => {
    const data = makeData({ description: undefined });

    const result = mapResponseToDomain(data, target, 'TEST');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('');
    }
  });

  test('normalizes a null description to an empty string', () => {
    const data = makeData({ description: null });

    const result = mapResponseToDomain(data, target, 'TEST');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('');
    }
  });
});
