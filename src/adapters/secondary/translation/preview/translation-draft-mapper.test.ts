import { describe, expect, test } from 'bun:test';
import { ErrorCode } from '../../../../shared/errors';
import { mapTranslationDraft } from './translation-draft-mapper';

const source =
  '  \u3053\u3093\u306b\u3061\u306f \u0e44\u0e17\u0e22 \u0645\u0631\u062d\u0628\u0627 \ud83d\ude00 "quoted { text }" \\path\nnext\tend  ';

const translated =
  '  Hello "reader" {keep braces} \\server\nnext \ud83d\ude00  ';

const pair = (overrides: Record<string, unknown> = {}) => ({
  blockIndex: 0,
  originalText: source,
  translatedText: translated,
  originalLanguageBcp47Code: 'ja-JP',
  romanization: 'konnichiwa',
  ...overrides,
});

const envelope = (segments: unknown[] = [pair()]) => ({
  success: true,
  error: null,
  data: { segments, description: 'Description {with} "quotes"' },
});

const emptySegment = (index = 0) => ({
  index,
  blockIndex: null,
  originalText: '',
  translatedText: '',
  sourceLanguageCode: null,
  romanization: null,
});

describe('Adapter: provisional translation draft mapping', () => {
  test.each(
    [null, [], false, 42, 'json', {}, { data: null }, { data: {} }].map(
      (value) => ({ value }),
    ),
  )(
    'normalizes malformed or absent roots without throwing: %j',
    ({ value }) => {
      expect(mapTranslationDraft(value)).toBeNull();
    },
  );

  test('preserves array indexes and pending placeholders when some paired rows are malformed', () => {
    const draft = mapTranslationDraft(
      envelope([pair(), null, { translatedText: 'third' }, false]),
    );

    expect(draft?.segments.map((segment) => segment.index)).toEqual([
      0, 1, 2, 3,
    ]);

    expect(draft?.segments[1]).toEqual(emptySegment(1));

    expect(draft?.segments[2]).toEqual({
      ...emptySegment(2),
      translatedText: 'third',
    });

    expect(draft?.segments[3]).toEqual(emptySegment(3));
  });

  test('normalizes wrong runtime field types without trusting deep-partial SDK types', () => {
    const draft = mapTranslationDraft({
      data: {
        segments: [
          {
            blockIndex: '0',
            originalText: 123,
            translatedText: [],
            originalLanguageBcp47Code: {},
            romanization: false,
          },
        ],
        description: { text: 'invalid' },
      },
    });

    expect(draft).toEqual({ segments: [emptySegment()], description: null });
  });

  test.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'keeps invalid block metadata pending: %s',
    (blockIndex) => {
      expect(
        mapTranslationDraft(envelope([{ blockIndex }]))?.segments[0]
          ?.blockIndex,
      ).toBeNull();
    },
  );

  test('retains incomplete language metadata without guessing a different complete code', () => {
    expect(
      mapTranslationDraft(envelope([{ originalLanguageBcp47Code: 'ja-' }]))
        ?.segments[0]?.sourceLanguageCode,
    ).toBe('ja-');
  });

  test('pairs legacy rows by their original indexes when either side arrives first', () => {
    for (const [originals, translations] of [
      [
        [
          { text: 'source-first', blockIndex: 0 },
          null,
          { text: 'source-third', blockIndex: 1 },
        ],
        [{ text: 'target-first', blockIndex: 0 }],
      ],
      [
        [{ text: 'source-first', blockIndex: 0 }],
        [
          { text: 'target-first', blockIndex: 0 },
          null,
          { text: 'target-third', blockIndex: 1 },
        ],
      ],
    ]) {
      const draft = mapTranslationDraft({
        data: {
          originalText: { contents: originals },
          translatedText: { contents: translations },
        },
      });

      expect(draft?.segments).toHaveLength(3);

      expect(draft?.segments.map((segment) => segment.index)).toEqual([
        0, 1, 2,
      ]);

      expect(draft?.segments[0]?.originalText).toBe('source-first');
      expect(draft?.segments[0]?.translatedText).toBe('target-first');
      expect(draft?.segments[1]).toEqual(emptySegment(1));
      expect(draft?.segments[2]?.blockIndex).toBe(1);

      expect(draft?.segments[2]?.originalText).toBe(
        originals.length === 3 ? 'source-third' : '',
      );

      expect(draft?.segments[2]?.translatedText).toBe(
        translations.length === 3 ? 'target-third' : '',
      );
    }
  });

  test('preserves legacy whitespace and metadata exactly while the opposite side is pending', () => {
    const draft = mapTranslationDraft({
      data: {
        originalText: {
          contents: [
            {
              text: '  OCR ',
              languageBcp47Code: 'ja-JP',
              romanization: '  ko ',
              blockIndex: 2,
            },
          ],
        },
      },
    });

    expect(draft).toEqual({
      segments: [
        {
          ...emptySegment(),
          originalText: '  OCR ',
          sourceLanguageCode: 'ja-JP',
          romanization: '  ko ',
          blockIndex: 2,
        },
      ],
      description: null,
    });
  });

  test('a provisional rejection clears stale data even if contradictory data remains in the snapshot', () => {
    expect(mapTranslationDraft({ ...envelope(), success: false })).toEqual({
      segments: [],
      description: null,
    });
  });

  test('a new response replaces the prior rows without retaining old indexes or text', () => {
    const old = mapTranslationDraft(
      envelope([pair(), pair({ originalText: 'old second' })]),
    );

    const replacement = mapTranslationDraft(
      envelope([{ translatedText: 'replacement' }]),
    );

    expect(old?.segments).toHaveLength(2);

    expect(replacement).toEqual({
      segments: [{ ...emptySegment(), translatedText: 'replacement' }],
      description: 'Description {with} "quotes"',
    });
  });

  test('accepts exactly 2048 paired or legacy rows and rejects 2049', () => {
    expect(
      mapTranslationDraft(envelope(Array.from({ length: 2048 }, () => ({}))))
        ?.segments,
    ).toHaveLength(2048);

    expect(
      mapTranslationDraft({
        data: {
          translatedText: {
            contents: Array.from({ length: 2048 }, () => ({})),
          },
        },
      })?.segments,
    ).toHaveLength(2048);

    expect(() =>
      mapTranslationDraft(envelope(Array.from({ length: 2049 }, () => ({})))),
    ).toThrow(
      expect.objectContaining({ code: ErrorCode.TRANSLATION_RESPONSE_LIMIT }),
    );

    expect(() =>
      mapTranslationDraft({
        data: {
          originalText: { contents: Array.from({ length: 2049 }, () => ({})) },
        },
      }),
    ).toThrow(
      expect.objectContaining({ code: ErrorCode.TRANSLATION_RESPONSE_LIMIT }),
    );

    expect(() =>
      mapTranslationDraft({
        data: {
          translatedText: {
            contents: Array.from({ length: 2049 }, () => ({})),
          },
        },
      }),
    ).toThrow(
      expect.objectContaining({ code: ErrorCode.TRANSLATION_RESPONSE_LIMIT }),
    );
  });
});
