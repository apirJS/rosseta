import { describe, expect, test } from 'bun:test';
import { ErrorCode } from '../../../../shared/errors';
import type { GenerationResult } from '../transports/GenerationTransport';
import { MAX_TRANSLATION_BYTES } from './translation-response-limits';
import { inspectGenerationCompletion } from './inspect-generation-completion';

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

describe('Adapter: inspectGenerationCompletion', () => {
  test('accepts a completed structured object even without transport text', () => {
    const result = inspectGenerationCompletion(
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
    const result = inspectGenerationCompletion(
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
    const result = inspectGenerationCompletion(
      generated({ validationError: new Error('SDK schema rejected output') }),
      '',
      false,
    );

    expect(result.kind).toBe('accepted');
  });

  test.each([null, { unexpected: true }])(
    'tries complete text when the SDK output is invalid: %j',
    (output) => {
      const result = inspectGenerationCompletion(
        generated({ output }),
        '',
        false,
      );

      expect(result.kind).toBe('accepted');
    },
  );

  test('tries accumulated text when the final transport text is malformed', () => {
    const result = inspectGenerationCompletion(
      generated({ text: '{"success":', output: { unexpected: true } }),
      validText,
      false,
    );

    expect(result.kind).toBe('accepted');
  });

  test('does not treat whitespace final text as an empty response when accumulated text is complete', () => {
    const result = inspectGenerationCompletion(
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
        inspectGenerationCompletion(generated({ output }), '', false).kind,
      ).toBe('accepted');
    }
  });

  test('retains nonempty accumulated text for repair when final text is whitespace', () => {
    const streamedText = '{"success":true,"data":';

    expect(
      inspectGenerationCompletion(
        generated({ text: ' \n ' }),
        streamedText,
        false,
      ),
    ).toEqual({ kind: 'repairable', previousResponse: streamedText });
  });

  test('repairs length termination even when its JSON is complete', () => {
    expect(
      inspectGenerationCompletion(
        generated({ finishReason: 'length', output: envelope }),
        validText,
        false,
      ),
    ).toEqual({ kind: 'repairable', previousResponse: validText });
  });

  test('repairs length termination with only an SDK object and no response text', () => {
    expect(
      inspectGenerationCompletion(
        generated({ text: '', finishReason: 'length', output: envelope }),
        '',
        false,
      ),
    ).toEqual({ kind: 'repairable', previousResponse: '' });
  });

  test.each(['other', 'error', 'unknown', 'tool-calls'])(
    'returns interrupted after a %s finish even when JSON is complete',
    (finishReason) => {
      const result = inspectGenerationCompletion(
        generated({ finishReason, output: envelope }),
        validText,
        false,
      );

      expect(result).toMatchObject({
        kind: 'failed',
        error: { code: ErrorCode.TRANSLATION_INTERRUPTED },
      });
    },
  );

  test('rejects filtered output even if complete text was received', () => {
    const result = inspectGenerationCompletion(
      generated({ finishReason: 'content-filter', output: envelope }),
      validText,
      false,
    );

    expect(result).toMatchObject({
      kind: 'failed',
      error: { code: ErrorCode.TRANSLATION_CONTENT_BLOCKED },
    });
  });

  test('requests repair for a truncated JSON document with stop termination', () => {
    const result = inspectGenerationCompletion(
      generated({ text: validText.slice(0, -1) }),
      '',
      false,
    );

    expect(result).toEqual({
      kind: 'repairable',
      previousResponse: validText.slice(0, -1),
    });
  });

  test('fails empty generation without requesting JSON repair', () => {
    const result = inspectGenerationCompletion(
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
      inspectGenerationCompletion(
        generated({ text: '', output: null }),
        ' ',
        false,
      ),
    ).toMatchObject({
      kind: 'failed',
      error: { code: ErrorCode.TRANSLATION_EMPTY_RESPONSE },
    });
  });

  test('empty output precedes unknown termination', () => {
    expect(
      inspectGenerationCompletion(
        generated({ text: '', output: null, finishReason: 'unknown' }),
        ' ',
        false,
      ),
    ).toMatchObject({
      kind: 'failed',
      error: { code: ErrorCode.TRANSLATION_EMPTY_RESPONSE },
    });
  });

  test.each(['unknown', 'content-filter'])(
    'raw text limits precede %s termination',
    (finishReason) => {
      expect(
        inspectGenerationCompletion(
          generated({
            text: 'x'.repeat(MAX_TRANSLATION_BYTES + 1),
            finishReason,
          }),
          '',
          false,
        ),
      ).toMatchObject({
        kind: 'failed',
        error: { code: ErrorCode.TRANSLATION_RESPONSE_LIMIT },
      });
    },
  );

  test('SDK object limits precede unknown termination and text recovery', () => {
    expect(
      inspectGenerationCompletion(
        generated({
          finishReason: 'unknown',
          output: { description: 'x'.repeat(MAX_TRANSLATION_BYTES) },
        }),
        validText,
        false,
      ),
    ).toMatchObject({
      kind: 'failed',
      error: { code: ErrorCode.TRANSLATION_RESPONSE_LIMIT },
    });
  });

  test.each(['generated', 'streamed'])(
    'enforces byte limits on %s text even with a valid SDK object',
    (source) => {
      const oversized = 'x'.repeat(MAX_TRANSLATION_BYTES + 1);

      const result = inspectGenerationCompletion(
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
    const result = inspectGenerationCompletion(
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
