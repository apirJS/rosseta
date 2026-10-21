import { z } from 'zod';
import type { TranslationData } from './translation-response-mapper';

const blockIndexSchema = z.number().int().nonnegative();

const segmentSchema = z
  .object({
    blockIndex: blockIndexSchema,
    originalText: z.string(),
    translatedText: z.string(),
    originalLanguageBcp47Code: z.string(),
    romanization: z.string().nullable(),
  })
  .strict();

export function createTranslationDataSchema(includeDescription = true) {
  const shape = { segments: z.array(segmentSchema) };

  const data = includeDescription
    ? z.object({ ...shape, description: z.string() }).strict()
    : z.object(shape).strict();

  return z
    .object({
      success: z.boolean(),
      error: z.string().nullable(),
      data: data.nullable(),
    })
    .strict();
}

// Receipt-only schemas tolerate omitted nullable metadata; requests stay strict.
export const pairedTranslationSchema = z
  .object({
    success: z.boolean(),
    error: z.string().nullable().optional(),
    data: z
      .object({
        segments: z.array(
          segmentSchema.extend({
            romanization: z.string().nullable().default(null),
          }),
        ),
        description: z.string().optional(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const translationDataSchema = createTranslationDataSchema();

const legacySegment = z
  .object({
    text: z.string(),
    languageBcp47Code: z.string(),
    language: z.string(),
    romanization: z.string().nullable().default(null),
    blockIndex: blockIndexSchema.default(0),
  })
  .strict();

export const translationDataLenientSchema = z
  .object({
    success: z.boolean(),
    error: z.string().nullish(),
    data: z
      .object({
        originalText: z.object({ contents: z.array(legacySegment) }).strict(),
        translatedText: z.object({ contents: z.array(legacySegment) }).strict(),
        description: z.string().nullish(),
      })
      .strict()
      .nullish(),
  })
  .strict();

export interface TranslationResponse {
  success: boolean;
  error: string | null;
  data: TranslationData | null;
}

// Existing completed/domain fixtures deliberately retain the legacy representation.
export type TranslationSchemaOutput = TranslationResponse;
export type TranslationSchemaLenientOutput = z.infer<
  typeof translationDataLenientSchema
>;
export type PairedTranslationResponse = z.infer<typeof pairedTranslationSchema>;
