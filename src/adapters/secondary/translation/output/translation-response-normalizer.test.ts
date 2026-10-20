import { describe, expect, test } from 'bun:test';
import { ErrorCode } from '../../../../shared/errors';
import { normalizeTranslationResponse } from './translation-response-normalizer';

function pair(blockIndex = 0) {
  return {
    blockIndex,
    originalText: '\u3053\u3093\u306b\u3061\u306f',
    translatedText: 'Hello',
    originalLanguageBcp47Code: 'ja-JP',
    romanization: 'konnichiwa',
  };
}

function paired(blocks = [0]) {
  return {
    success: true,
    error: null,
    data: { segments: blocks.map(pair), description: '' },
  };
}

function legacy(blocks = [0]) {
  const segments = () =>
    blocks.map((blockIndex) => ({
      text: 'text',
      languageBcp47Code: 'en-US',
      language: 'English',
      romanization: null,
      blockIndex,
    }));

  return {
    success: true,
    error: null,
    data: {
      originalText: { contents: segments() },
      translatedText: { contents: segments() },
      description: '',
    },
  };
}

function expectMalformed(raw: unknown): void {
  const result = normalizeTranslationResponse(raw);

  expect(result.success).toBe(false);
  if (!result.success)
    expect(result.error.code).toBe(ErrorCode.TRANSLATION_MALFORMED_RESPONSE);
}

describe('Adapter: complete translation response normalization', () => {
  test('expands paired segments into the unchanged canonical history representation', () => {
    const result = normalizeTranslationResponse(paired([0, 0, 1]), true);

    expect(result.success).toBe(true);
    if (!result.success || !result.data.data)
      throw new Error('Expected normalized success');

    const data = result.data.data;

    expect(
      data.originalText.contents.map((segment) => segment.blockIndex),
    ).toEqual([0, 0, 1]);

    expect(
      data.translatedText.contents.map((segment) => segment.blockIndex),
    ).toEqual([0, 0, 1]);

    expect(data.originalText.contents[0]).toEqual({
      text: '\u3053\u3093\u306b\u3061\u306f',
      blockIndex: 0,
      languageBcp47Code: 'ja-JP',
      language: 'Japanese',
      romanization: 'konnichiwa',
    });

    expect(data.translatedText.contents[0]).toEqual({
      text: 'Hello',
      blockIndex: 0,
      languageBcp47Code: 'unknown',
      language: 'Unknown',
      romanization: null,
    });

    expect(data.description).toBe('');
    expect('segments' in data).toBe(false);
  });

  test('accepts existing completed responses and their omitted parse-only block index', () => {
    const original = legacy();

    expect(normalizeTranslationResponse(original)).toEqual({
      success: true,
      data: original,
    });

    const withoutIndexes = {
      ...original,
      data: {
        ...original.data,
        originalText: {
          contents: original.data.originalText.contents.map(
            ({ blockIndex: _block, ...segment }) => segment,
          ),
        },
        translatedText: {
          contents: original.data.translatedText.contents.map(
            ({ blockIndex: _block, ...segment }) => segment,
          ),
        },
      },
    };

    const result = normalizeTranslationResponse(withoutIndexes);

    expect(result.success).toBe(true);
    if (!result.success) throw result.error;
    expect(result.data.data?.originalText.contents[0]?.blockIndex).toBe(0);
    expect(result.data.data?.translatedText.contents[0]?.blockIndex).toBe(0);
  });

  test('keeps an unrecognized source language for the existing unknown-language mapping', () => {
    const response = paired();

    response.data.segments[0]!.originalLanguageBcp47Code =
      'unsupported-model-code';

    const result = normalizeTranslationResponse(response);

    expect(result.success).toBe(true);
    if (!result.success) throw result.error;

    expect(result.data.data?.originalText.contents[0]?.language).toBe(
      'Unknown',
    );

    expect(result.data.data?.originalText.contents[0]?.languageBcp47Code).toBe(
      'unsupported-model-code',
    );
  });

  test('requires description only when explicitly requested and accepts an empty description', () => {
    const { description: _description, ...data } = paired().data;
    const response = { success: true, error: null, data };

    expect(normalizeTranslationResponse(response, false).success).toBe(true);
    expect(normalizeTranslationResponse(response, true).success).toBe(false);
    expect(normalizeTranslationResponse(paired(), true).success).toBe(true);
  });

  test('rejects mixed paired and legacy envelopes instead of choosing one interpretation', () => {
    const response = {
      ...paired(),
      data: { ...paired().data, ...legacy().data },
    };

    expectMalformed(response);
  });

  test.each(
    [[1], [0, 2], [0, 1, 0], [0, 0, 3], [-1], [0.5]].map((blocks) => ({
      blocks,
    })),
  )(
    'rejects invalid visual block ordering for both response formats: %j',
    ({ blocks }) => {
      expectMalformed(paired(blocks));
      expectMalformed(legacy(blocks));
    },
  );

  test('rejects mismatched legacy counts and corresponding block indexes', () => {
    const mismatchedCount = legacy([0, 1]);

    mismatchedCount.data.translatedText.contents.pop();
    expectMalformed(mismatchedCount);

    const mismatchedBlock = legacy([0, 1]);

    mismatchedBlock.data.translatedText.contents[1]!.blockIndex = 0;
    expectMalformed(mismatchedBlock);
  });

  test('rejects empty segments and whitespace-only source or target text', () => {
    expectMalformed(paired([]));
    expectMalformed(legacy([]));

    for (const key of ['originalText', 'translatedText'] as const) {
      const response = paired();

      response.data.segments[0]![key] = ' \n\t ';
      expectMalformed(response);
    }
  });

  test('accepts completed no-text rejection without turning it into translation success', () => {
    const response = { success: false, error: 'NO_TEXT_FOUND', data: null };

    expect(normalizeTranslationResponse(response)).toEqual({
      success: true,
      data: response,
    });
  });

  test.each([
    { success: false, error: null, data: null },
    { success: false, error: ' \n ', data: null },
    { success: false, error: 'NO_TEXT_FOUND', data: paired().data },
    { success: true, error: 'NO_TEXT_FOUND', data: paired().data },
    { success: true, error: null, data: null },
    {
      success: true,
      error: null,
      data: { segments: [{ originalText: 'partial' }] },
    },
  ])('rejects contradictory or unfinished response envelopes: %j', (raw) => {
    expectMalformed(raw);
  });

  test('rejects wrong runtime field types and extra generated properties', () => {
    const response = paired();

    expectMalformed({
      ...response,
      data: { ...response.data, segments: [{ ...pair(), translatedText: 5 }] },
    });

    expectMalformed({
      ...response,
      data: { ...response.data, segments: [{ ...pair(), blockIndex: '0' }] },
    });

    expectMalformed({
      ...response,
      data: {
        ...response.data,
        segments: [{ ...pair(), modelDebug: 'extra' }],
      },
    });
  });

  test('enforces the segment limit for paired and either legacy side', () => {
    expect(
      normalizeTranslationResponse(
        paired(Array.from({ length: 2048 }, () => 0)),
      ).success,
    ).toBe(true);

    for (const response of [
      paired(Array.from({ length: 2049 }, () => 0)),
      legacy(Array.from({ length: 2049 }, () => 0)),
    ]) {
      const result = normalizeTranslationResponse(response);

      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.code).toBe(ErrorCode.TRANSLATION_RESPONSE_LIMIT);
    }
  });

  test('enforces the UTF-8 byte limit before accepting complete response data', () => {
    const response = paired();

    response.data.segments[0]!.originalText = '\u3053'.repeat(350_000);

    const result = normalizeTranslationResponse(response);

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_RESPONSE_LIMIT);
  });
});
