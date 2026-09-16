import { z } from 'zod';
import type { TranslationData } from './translation-response-mapper';

const blockIndexSchema = z.number().int().nonnegative();

const textSegmentSchema = z.object({
  text: z.string(),
  languageBcp47Code: z.string(),
  language: z.string(),
  romanization: z.nullable(z.string()),
  blockIndex: blockIndexSchema,
});

const textSegmentLenientSchema = textSegmentSchema.extend({
  blockIndex: blockIndexSchema.default(0),
});

export interface TranslationResponse {
  success: boolean;
  error: string | null;
  data: TranslationData | null;
}

export function createTranslationDataSchema(
  includeDescription = true,
): z.ZodType<TranslationResponse> {
  const baseShape = {
    originalText: z.object({ contents: z.array(textSegmentSchema) }),
    translatedText: z.object({ contents: z.array(textSegmentSchema) }),
  };

  const dataSchema = includeDescription
    ? z.object({ ...baseShape, description: z.string() })
    : z.object(baseShape);

  return z.object({
    success: z.boolean(),
    error: z.string().nullable(),
    data: dataSchema.nullable(),
  });
}

export const translationDataSchema = createTranslationDataSchema(true);

const translationDataInnerLenientSchema = z.object({
  originalText: z.object({
    contents: z.array(textSegmentLenientSchema),
  }),
  translatedText: z.object({
    contents: z.array(textSegmentLenientSchema),
  }),
  description: z.string().nullish(),
});

export const translationDataLenientSchema = z.object({
  success: z.boolean(),
  error: z.string().nullish(),
  data: translationDataInnerLenientSchema.nullish(),
});

export type TranslationSchemaOutput = z.infer<typeof translationDataSchema>;
export type TranslationSchemaLenientOutput = z.infer<
  typeof translationDataLenientSchema
>;
