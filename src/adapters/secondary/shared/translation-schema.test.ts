import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import {
  createTranslationDataSchema,
  translationDataSchema,
  translationDataLenientSchema,
} from './translation-schema';
import { VALID_TRANSLATION_RESPONSE } from '../../../../tests/test-fixtures';

interface JsonSchemaNode {
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
}

function collectPropertiesMissingFromRequired(
  node: JsonSchemaNode,
  path = '$',
): string[] {
  const missing: string[] = [];

  if (node.properties) {
    const required = node.required ?? [];
    for (const [key, child] of Object.entries(node.properties)) {
      if (!required.includes(key)) missing.push(`${path}.${key}`);
      missing.push(
        ...collectPropertiesMissingFromRequired(child, `${path}.${key}`),
      );
    }
  }

  if (node.items) {
    missing.push(...collectPropertiesMissingFromRequired(node.items, `${path}[]`));
  }

  for (const branchKey of ['anyOf', 'oneOf', 'allOf'] as const) {
    const branches = node[branchKey];
    if (branches) {
      branches.forEach((branch, index) => {
        missing.push(
          ...collectPropertiesMissingFromRequired(
            branch,
            `${path}.${branchKey}[${index}]`,
          ),
        );
      });
    }
  }

  return missing;
}

describe('Adapter: translation schema', () => {
  test('wire schema lists every property in required (strict json_schema endpoints)', () => {
    const jsonSchema = z.toJSONSchema(translationDataSchema);
    const required = (jsonSchema as { required?: string[] }).required ?? [];

    expect(jsonSchema.type).toBe('object');
    expect(required).toContain('success');
    expect(required).toContain('error');
    expect(required).toContain('data');
  });

  test('every property is required at every nesting level (Groq strict mode)', () => {
    for (const includeDescription of [true, false]) {
      const jsonSchema = z.toJSONSchema(
        createTranslationDataSchema(includeDescription),
      ) as JsonSchemaNode;

      expect(collectPropertiesMissingFromRequired(jsonSchema)).toEqual([]);
    }
  });

  test('wire schema includes description when requested', () => {
    const json = JSON.stringify(z.toJSONSchema(createTranslationDataSchema(true)));

    expect(json).toContain('"description"');
  });

  test('wire schema omits description entirely when not requested', () => {
    const json = JSON.stringify(
      z.toJSONSchema(createTranslationDataSchema(false)),
    );

    expect(json).not.toContain('"description"');
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

  test('schema without description accepts a success response that omits it', () => {
    const result = createTranslationDataSchema(false).safeParse({
      success: true,
      error: null,
      data: {
        originalText: VALID_TRANSLATION_RESPONSE.data!.originalText,
        translatedText: VALID_TRANSLATION_RESPONSE.data!.translatedText,
      },
    });

    expect(result.success).toBe(true);
  });

  test('wire schema rejects a segment missing blockIndex', () => {
    const withoutBlockIndex = {
      success: true,
      error: null,
      data: {
        ...VALID_TRANSLATION_RESPONSE.data,
        originalText: {
          contents: [
            {
              languageBcp47Code: 'ja-JP',
              language: 'Japanese',
              romanization: 'konnichiwa',
              text: 'こんにちは',
            },
          ],
        },
      },
    };

    expect(translationDataSchema.safeParse(withoutBlockIndex).success).toBe(
      false,
    );
  });

  test('lenient schema defaults a missing blockIndex to 0', () => {
    const parsed = translationDataLenientSchema.safeParse({
      success: true,
      data: {
        ...VALID_TRANSLATION_RESPONSE.data,
        originalText: {
          contents: [
            {
              languageBcp47Code: 'ja-JP',
              language: 'Japanese',
              romanization: 'konnichiwa',
              text: 'こんにちは',
            },
          ],
        },
      },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data?.originalText.contents[0].blockIndex).toBe(0);
    }
  });
});
