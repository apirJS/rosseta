import { describe, expect, test } from 'bun:test';
import { ErrorCode } from '../../../../shared/errors';
import type { GenerationResult } from '../transports/GenerationTransport';
import { MAX_TRANSLATION_BYTES } from '../preview/translation-response-limits';
import { inspectTranslationCompletion } from './translation-completion';

const envelope = {
  success: true,
  error: null,
  data: {
    segments: [
      {
        blockIndex: 0,
        originalText: 'こんにちは',
        translatedText: 'Hello',
        originalLanguageBcp47Code: 'ja-JP',
        romanization: 'konnichiwa',
      },
    ],
  },
};

const validText = JSON.stringify(envelope);

function generated(
  overrides: Partial<GenerationResult> = {},
): GenerationResult {
  return {
    text: validText,
    finishReason: 'stop',
    schemaValidated: false,
    ...overrides,
  };
}

describe('Adapter: inspectTranslationCompletion', () => {
  test('accepts a completed structured object even without transport text', () => {
    const result = inspectTranslationCompletion(
      generated({ text: '', output: envelope, schemaValidated: true }),
      '',
      false,
    );

    expect(result).toMatchObject({
      kind: 'accepted',
      response: { data: { translatedText: { contents: [{ text: 'Hello' }] } } },
    });
  });

  test('prefers the validated structured output over alternative text', () => {
    const result = inspectTranslationCompletion(
      generated({
        output: {
          ...envelope,
          data: {
            segments: [{ ...envelope.data.segments[0], translatedText: 'Hi' }],
          },
        },
      }),
      validText,
      false,
    );

    expect(result).toMatchObject({
      kind: 'accepted',
      response: { data: { translatedText: { contents: [{ text: 'Hi' }] } } },
    });
  });

  test('accepts complete text recovered from SDK schema rejection', () => {
    const result = inspectTranslationCompletion(
      generated({ validationError: new Error('SDK schema rejected output') }),
      '',
      false,
    );

    expect(result.kind).toBe('accepted');
  });

  test.each([null, { unexpected: true }])(
    'tries complete text when the SDK output is invalid: %j',
    (output) => {
      const result = inspectTranslationCompletion(
        generated({ output }),
        '',
        false,
      );

      expect(result.kind).toBe('accepted');
    },
  );

  test('tries accumulated text when the final transport text is malformed', () => {
    const result = inspectTranslationCompletion(
      generated({ text: '{"success":', output: { unexpected: true } }),
      validText,
      false,
    );

    expect(result.kind).toBe('accepted');
  });

  test('does not treat whitespace final text as an empty response when accumulated text is complete', () => {
    const result = inspectTranslationCompletion(
      generated({ text: ' ' }),
      validText,
      false,
    );

    expect(result.kind).toBe('accepted');
  });

  test('tries complete text after an unserializable SDK object', () => {
    const cyclic: Record<string, unknown> = {};

    cyclic.self = cyclic;

    for (const output of [cyclic, { sdkMetadata: 1n }]) {
      expect(
        inspectTranslationCompletion(generated({ output }), '', false).kind,
      ).toBe('accepted');
    }
  });

  test('retains nonempty accumulated text for repair when final text is whitespace', () => {
    const streamedText = '{"success":true,"data":';

    expect(
      inspectTranslationCompletion(
        generated({ text: ' \n ' }),
        streamedText,
        false,
      ),
    ).toEqual({ kind: 'incomplete', text: streamedText, finishReason: 'stop' });
  });

  test.each(['length', 'error', 'unknown', 'tool-calls'])(
    'does not accept balanced JSON after a %s finish',
    (finishReason) => {
      const result = inspectTranslationCompletion(
        generated({ finishReason, output: envelope }),
        validText,
        false,
      );

      expect(result).toMatchObject({ kind: 'incomplete', finishReason });
    },
  );

  test('rejects filtered output even if complete text was received', () => {
    const result = inspectTranslationCompletion(
      generated({ finishReason: 'content-filter', output: envelope }),
      validText,
      false,
    );

    expect(result).toMatchObject({
      kind: 'failed',
      error: { code: ErrorCode.TRANSLATION_CONTENT_BLOCKED },
    });
  });

  test('does not repair or accept a truncated final JSON document', () => {
    const result = inspectTranslationCompletion(
      generated({ text: validText.slice(0, -1) }),
      '',
      false,
    );

    expect(result.kind).toBe('incomplete');
  });

  test('fails empty generation without requesting JSON repair', () => {
    const result = inspectTranslationCompletion(
      generated({ text: ' ' }),
      '',
      false,
    );

    expect(result).toMatchObject({
      kind: 'failed',
      error: { code: ErrorCode.TRANSLATION_EMPTY_RESPONSE },
    });
  });

  test('treats null SDK output without any text as an empty generation', () => {
    expect(
      inspectTranslationCompletion(
        generated({ text: '', output: null }),
        ' ',
        false,
      ),
    ).toMatchObject({
      kind: 'failed',
      error: { code: ErrorCode.TRANSLATION_EMPTY_RESPONSE },
    });
  });

  test.each(['generated', 'streamed'])(
    'enforces byte limits on %s text even with a valid SDK object',
    (source) => {
      const oversized = 'x'.repeat(MAX_TRANSLATION_BYTES + 1);

      const result = inspectTranslationCompletion(
        generated({
          text: source === 'generated' ? oversized : validText,
          output: envelope,
        }),
        source === 'streamed' ? oversized : validText,
        false,
      );

      expect(result).toMatchObject({
        kind: 'failed',
        error: { code: ErrorCode.TRANSLATION_RESPONSE_LIMIT },
      });
    },
  );

  test('does not bypass limits on the structured object with alternative text', () => {
    const result = inspectTranslationCompletion(
      generated({
        output: {
          ...envelope,
          data: {
            ...envelope.data,
            description: 'x'.repeat(MAX_TRANSLATION_BYTES),
          },
        },
      }),
      validText,
      false,
    );

    expect(result).toMatchObject({
      kind: 'failed',
      error: { code: ErrorCode.TRANSLATION_RESPONSE_LIMIT },
    });
  });
});
