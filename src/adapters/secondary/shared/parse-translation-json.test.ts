import { describe, expect, test } from 'bun:test';
import {
  extractJsonObject,
  extractJsonObjects,
  parseTranslationResponse,
} from './parse-translation-json';
import { ErrorCode } from '../../../shared/errors';

const VALID_PAYLOAD = `{"success":true,"data":{"originalText":{"contents":[{"text":"Where to Find Your Likes","languageBcp47Code":"en-US","language":"English","romanization":null}]},"translatedText":{"contents":[{"text":"Cara Menemukan Suka Anda","languageBcp47Code":"id-ID","language":"Indonesian","romanization":null}]},"description":""}}`;

describe('Adapter: extractJsonObject', () => {
  test('extracts a plain JSON object', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  test('extracts JSON from markdown fences', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  test('extracts JSON from surrounding prose', () => {
    expect(extractJsonObject('Here is the result: {"a":1} hope this helps')).toBe(
      '{"a":1}',
    );
  });

  test('ignores braces inside strings', () => {
    expect(extractJsonObject('{"a":"} not a close {"}')).toBe(
      '{"a":"} not a close {"}',
    );
  });

  test('handles escaped quotes inside strings', () => {
    expect(extractJsonObject('{"a":"she said \\"} hi\\""}')).toBe(
      '{"a":"she said \\"} hi\\""}',
    );
  });

  test('takes the first complete object when multiple exist', () => {
    expect(extractJsonObject('{"a":1} trailing {"b":2}')).toBe('{"a":1}');
  });

  test('returns all balanced object candidates in the response', () => {
    expect(extractJsonObjects('trace: {"step":1}\nanswer: {"a":2}')).toEqual([
      '{"step":1}',
      '{"a":2}',
    ]);
  });

  test('returns null for text without an object', () => {
    expect(extractJsonObject('no json here')).toBeNull();
    expect(extractJsonObject('')).toBeNull();
  });

  test('returns null for a truncated object', () => {
    expect(extractJsonObject('{"a":1')).toBeNull();
  });
});

describe('Adapter: parseTranslationResponse', () => {
  test('parses a real-world success payload that omits the error key', () => {
    const result = parseTranslationResponse(VALID_PAYLOAD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(true);
      expect(result.data.error).toBeNull();
      expect(result.data.data?.originalText.contents[0].text).toBe(
        'Where to Find Your Likes',
      );
    }
  });

  test('parses a failure payload that omits the data key', () => {
    const result = parseTranslationResponse('{"success":false,"error":"NO_TEXT_FOUND"}');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('NO_TEXT_FOUND');
      expect(result.data.data).toBeNull();
    }
  });

  test('parses a payload wrapped in markdown fences', () => {
    const result = parseTranslationResponse(
      '```json\n' + VALID_PAYLOAD + '\n```',
    );

    expect(result.success).toBe(true);
  });

  test('parses a payload with prose around it', () => {
    const result = parseTranslationResponse(
      'Sure! Here is the translation:\n' + VALID_PAYLOAD + '\nLet me know if you need anything else.',
    );

    expect(result.success).toBe(true);
  });

  test('skips an unrelated JSON object before the translation payload', () => {
    const result = parseTranslationResponse(
      'The model selected this route: {"provider":"puter"}.\n' +
        'Final answer:\n' +
        VALID_PAYLOAD,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data?.originalText.contents[0].text).toBe(
        'Where to Find Your Likes',
      );
    }
  });

  test('finds the payload after an incomplete object in the response', () => {
    const result = parseTranslationResponse(
      'Debug details: {"attempt":1\n' + VALID_PAYLOAD,
    );

    expect(result.success).toBe(true);
  });

  test('fails with malformedResponse for non-JSON text', () => {
    const result = parseTranslationResponse('I could not read the image.');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_MALFORMED_RESPONSE);
    }
  });

  test('fails with malformedResponse for JSON that does not match the schema', () => {
    const result = parseTranslationResponse('{"foo":"bar"}');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_MALFORMED_RESPONSE);
    }
  });

  test('fails with malformedResponse for truncated JSON', () => {
    const result = parseTranslationResponse(VALID_PAYLOAD.slice(0, -10));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_MALFORMED_RESPONSE);
    }
  });
});
