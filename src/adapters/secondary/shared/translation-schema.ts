import { z } from 'zod';

const textSegmentSchema = z.object({
  text: z.string(),
  languageBcp47Code: z.string(),
  language: z.string(),
  romanization: z.nullable(z.string()),
});

const translationDataInnerSchema = z.object({
  originalText: z.object({
    contents: z.array(textSegmentSchema),
  }),
  translatedText: z.object({
    contents: z.array(textSegmentSchema),
  }),
  description: z.string(),
});

export const translationDataSchema = z.object({
  success: z.boolean(),
  error: z.string().nullable(),
  data: translationDataInnerSchema.nullable(),
});

export const translationDataLenientSchema = z.object({
  success: z.boolean(),
  error: z.string().nullish(),
  data: translationDataInnerSchema.nullish(),
});

export type TranslationSchemaOutput = z.infer<typeof translationDataSchema>;
export type TranslationSchemaLenientOutput = z.infer<
  typeof translationDataLenientSchema
>;
