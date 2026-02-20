import { z } from 'zod';

const TextContentItemSchema = z.object({
  text: z.string(),
  languageBcp47Code: z.string(),
  language: z.string(),
  romanization: z.nullable(z.string()),
});

const OriginalTextSchema = z.object({
  contents: z.array(TextContentItemSchema),
});

const TranslatedTextSchema = z.object({
  contents: z.array(TextContentItemSchema),
});

const TranslationDataSchema = z.object({
  originalText: OriginalTextSchema,
  translatedText: TranslatedTextSchema,
  description: z.string(),
});

export const TranslationResponseBaseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional().nullable(),
  data: TranslationDataSchema.optional().nullable(),
});

export const TranslationResponseSchema = TranslationResponseBaseSchema.refine(
  (data) => {
    if (data.success) return !!data.data && !data.error;
    return !!data.error && !data.data;
  },
  {
    message:
      "Either 'data' (on success) or 'error' (on failure) must be present, never both.",
  },
);

export type TranslationResponse = z.infer<typeof TranslationResponseSchema>;
