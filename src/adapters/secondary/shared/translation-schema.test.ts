import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import {
  translationDataSchema,
  translationDataLenientSchema,
} from './translation-schema';
import { VALID_TRANSLATION_RESPONSE } from '../../../../tests/test-fixtures';

describe('Adapter: translation schema', () => {
  test('wire schema lists every property in required (strict json_schema endpoints)', () => {
    const jsonSchema = z.toJSONSchema(translationDataSchema);
    const required = (jsonSchema as { required?: string[] }).required ?? [];

    expect(jsonSchema.type).toBe('object');
    expect(required).toContain('success');
    expect(required).toContain('error');
    expect(required).toContain('data');
  });

  test('wire schema accepts a fully-formed response', () => {
    const result = translationDataSchema.safeParse(VALID_TRANSLATION_RESPONSE);

    expect(result.success).toBe(true);
  });

  test('wire schema rejects a response that omits the error key', () => {
    const result = translationDataSchema.safeParse({
      success: true,
      data: VALID_TRANSLATION_RESPONSE.data,
    });

    expect(result.success).toBe(false);
  });

  test('lenient schema accepts a response that omits the error key', () => {
    const result = translationDataLenientSchema.safeParse({
      success: true,
      data: VALID_TRANSLATION_RESPONSE.data,
    });

    expect(result.success).toBe(true);
  });

  test('lenient schema accepts a failure response that omits the data key', () => {
    const result = translationDataLenientSchema.safeParse({
      success: false,
      error: 'NO_TEXT_FOUND',
    });

    expect(result.success).toBe(true);
  });
});
