/* eslint-disable no-await-in-loop -- Every possible stream split must be checked in order. */
import { describe, expect, test } from 'bun:test';
import type { TranslationDraft } from '../../../../core/ports/outbound/TranslationExecutionOptions';
import { ErrorCode } from '../../../../shared/errors';
import {
  MAX_TRANSLATION_BYTES,
  parsePartialTranslationJson,
} from './parse-partial-translation-json';
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

function assertPrefixDraft(draft: TranslationDraft | null): void {
  if (!draft) return;
  expect(draft.segments.length).toBeLessThanOrEqual(1);

  for (const segment of draft.segments) {
    expect(segment.index).toBe(0);
    expect(source.startsWith(segment.originalText)).toBe(true);
    expect(translated.startsWith(segment.translatedText)).toBe(true);
    expect(segment.blockIndex === null || segment.blockIndex === 0).toBe(true);

    expect(
      segment.sourceLanguageCode === null ||
        'ja-JP'.startsWith(segment.sourceLanguageCode),
    ).toBe(true);

    expect(
      segment.romanization === null ||
        'konnichiwa'.startsWith(segment.romanization),
    ).toBe(true);
  }

  expect(
    draft.description === null ||
      'Description {with} "quotes"'.startsWith(draft.description),
  ).toBe(true);
}

describe('Adapter: partial translation JSON parsing', () => {
  test('safely parses every split of multilingual JSON without inventing text or trimming partial strings', async () => {
    const json = JSON.stringify(envelope());
    let sawUnfinishedSource = false;
    let sawUnfinishedTranslation = false;

    for (let split = 0; split <= json.length; split++) {
      const draft = await parsePartialTranslationJson(json.slice(0, split));

      assertPrefixDraft(draft);

      const segment = draft?.segments[0];

      if (segment?.originalText && segment.originalText !== source)
        sawUnfinishedSource = true;
      if (segment?.translatedText && segment.translatedText !== translated)
        sawUnfinishedTranslation = true;
    }

    expect(sawUnfinishedSource).toBe(true);
    expect(sawUnfinishedTranslation).toBe(true);

    const complete = await parsePartialTranslationJson(json);

    expect(complete?.segments[0]?.originalText).toBe(source);
    expect(complete?.segments[0]?.translatedText).toBe(translated);
  });

  test('safely parses every split inside explicit Unicode and backslash escapes', async () => {
    const json =
      '{"success":true,"error":null,"data":{"segments":[{"blockIndex":0,"originalText":"\\u3053\\u3093 \\"quoted\\" \\\\root","translatedText":"Hello\\nworld","originalLanguageBcp47Code":"ja-JP","romanization":null}]}}';

    const expectedSource = '\u3053\u3093 "quoted" \\root';
    const expectedTarget = 'Hello\nworld';
    let useful = 0;

    for (let split = 0; split <= json.length; split++) {
      const draft = await parsePartialTranslationJson(json.slice(0, split));
      const segment = draft?.segments[0];

      if (!segment) continue;
      useful++;
      expect(expectedSource.startsWith(segment.originalText)).toBe(true);
      expect(expectedTarget.startsWith(segment.translatedText)).toBe(true);
    }

    expect(useful).toBeGreaterThan(0);

    expect(
      (await parsePartialTranslationJson(json))?.segments[0]?.originalText,
    ).toBe(expectedSource);
  });

  test('shows an unfinished string before metadata, closing quotes, and closing brackets arrive', async () => {
    const draft = await parsePartialTranslationJson(
      '{"success":true,"data":{"segments":[{"originalText":"Hel',
    );

    expect(draft).toEqual({
      segments: [{ ...emptySegment(), originalText: 'Hel' }],
      description: null,
    });
  });

  test('does not depend on provider property order', async () => {
    const draft = await parsePartialTranslationJson(
      '{"data":{"segments":[{"translatedText":"Bonj',
    );

    expect(draft).toEqual({
      segments: [{ ...emptySegment(), translatedText: 'Bonj' }],
      description: null,
    });
  });

  test('keeps legacy source and target rows aligned at every stream split', async () => {
    const originals = [source, 'second source'];
    const translations = [translated, 'second target'];

    const json = JSON.stringify({
      success: true,
      data: {
        originalText: {
          contents: originals.map((text, blockIndex) => ({
            text,
            blockIndex,
            languageBcp47Code: 'ja-JP',
            romanization: null,
          })),
        },
        translatedText: {
          contents: translations.map((text, blockIndex) => ({
            text,
            blockIndex,
          })),
        },
      },
    });

    let sawPendingTarget = false;

    for (let split = 0; split <= json.length; split++) {
      const draft = await parsePartialTranslationJson(json.slice(0, split));

      if (!draft) continue;
      expect(draft.segments.length).toBeLessThanOrEqual(2);

      for (const segment of draft.segments) {
        expect(originals[segment.index]!.startsWith(segment.originalText)).toBe(
          true,
        );

        expect(
          translations[segment.index]!.startsWith(segment.translatedText),
        ).toBe(true);

        if (segment.originalText && !segment.translatedText)
          sawPendingTarget = true;
      }
    }

    expect(sawPendingTarget).toBe(true);

    const complete = await parsePartialTranslationJson(json);

    expect(
      complete?.segments.map((segment) => [
        segment.index,
        segment.originalText,
        segment.translatedText,
      ]),
    ).toEqual([
      [0, source, translated],
      [1, 'second source', 'second target'],
    ]);
  });

  test.each([
    '',
    'Loading...',
    '```json\n',
    '{}',
    '{"data":null}',
    '{"success":true}',
  ])(
    'keeps loading for a prefix without identifiable translation data: %s',
    async (prefix) => {
      expect(await parsePartialTranslationJson(prefix)).toBeNull();
    },
  );

  test.each(['```json\n', '```JSON\n', '```\n', 'Here is the result:\n'])(
    'recovers an unfinished envelope after a fence or prose prefix: %s',
    async (prefix) => {
      const draft = await parsePartialTranslationJson(
        prefix + '{"success":true,"data":{"segments":[{"translatedText":"Hel',
      );

      expect(draft?.segments[0]?.translatedText).toBe('Hel');
    },
  );

  test('ignores unrelated objects and quoted braces while identifying the response', async () => {
    const draft = await parsePartialTranslationJson(
      'Trace: {"route":"ignored { \\"braces\\" }"}\nResult:\n' +
        JSON.stringify(envelope()),
    );

    expect(draft?.segments[0]?.originalText).toBe(source);
    expect(draft?.segments[0]?.translatedText).toBe(translated);
  });

  test('withholds ambiguous complete or partial candidate envelopes', async () => {
    const complete = JSON.stringify(envelope());

    expect(
      await parsePartialTranslationJson(complete + '\n' + complete),
    ).toBeNull();

    expect(
      await parsePartialTranslationJson(
        complete + '\n{"data":{"segments":[{"translatedText":"Another',
      ),
    ).toBeNull();
  });

  test('withholds preview inside an incomplete surrounding object until the envelope is identifiable', async () => {
    expect(
      await parsePartialTranslationJson(
        'Trace: {"attempt":1\n' + JSON.stringify(envelope()),
      ),
    ).toBeNull();
  });

  test('bounds candidate scanning when the response contains many unrelated objects', async () => {
    expect(
      await parsePartialTranslationJson(
        '{}\n'.repeat(33) + JSON.stringify(envelope()),
      ),
    ).toBeNull();
  });

  test('clears the provisional preview when a no-text rejection starts arriving', async () => {
    expect(
      await parsePartialTranslationJson('{"success":false,"error":"NO_TEXT'),
    ).toEqual({ segments: [], description: null });

    expect(
      await parsePartialTranslationJson(
        '{"success":false,"error":"NO_TEXT_FOUND","data":null}',
      ),
    ).toEqual({ segments: [], description: null });
  });

  test('accepts the exact UTF-8 byte limit and rejects even one extra byte', async () => {
    const json = JSON.stringify(envelope([]));

    const atLimit =
      json +
      ' '.repeat(
        MAX_TRANSLATION_BYTES - new TextEncoder().encode(json).byteLength,
      );

    expect((await parsePartialTranslationJson(atLimit))?.segments).toEqual([]);

    await expect(
      parsePartialTranslationJson(atLimit + ' '),
    ).rejects.toMatchObject({ code: ErrorCode.TRANSLATION_RESPONSE_LIMIT });
  });

  test('enforces the byte limit for multibyte text rather than JavaScript string length', async () => {
    const oversized = '\ud83d\ude00'.repeat(MAX_TRANSLATION_BYTES / 4 + 1);

    expect(oversized.length).toBeLessThan(MAX_TRANSLATION_BYTES);

    await expect(parsePartialTranslationJson(oversized)).rejects.toMatchObject({
      code: ErrorCode.TRANSLATION_RESPONSE_LIMIT,
    });
  });

  test('rejects a parsed response above the segment limit', async () => {
    await expect(
      parsePartialTranslationJson(
        JSON.stringify(envelope(Array.from({ length: 2049 }, () => ({})))),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.TRANSLATION_RESPONSE_LIMIT });
  });
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
