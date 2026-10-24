import { z } from 'zod';

/** Canonical completed data shared by receipt validation and domain mapping. */
export interface NormalizedResponseSegment {
  text: string;
  languageBcp47Code: string;
  language: string;
  romanization: string | null;
  blockIndex: number;
}

export interface NormalizedTranslationData {
  originalText: { contents: NormalizedResponseSegment[] };
  translatedText: { contents: NormalizedResponseSegment[] };
  description?: string | null;
}

export interface NormalizedTranslationResponse {
  success: boolean;
  error: string | null;
  data: NormalizedTranslationData | null;
}

const blockIndexSchema = z
  .number()
  .int()
  .nonnegative()
  .describe(
    'Zero-based visual block index. Segments in the same block share the index; each new block increases it by one.',
  );

const segmentSchema = z
  .object({
    blockIndex: blockIndexSchema,
    originalText: z
      .string()
      .describe(
        'Exact visible source content, including text, emoji, symbols and punctuation. Do not reconstruct missing or unreadable content.',
      ),
    translatedText: z
      .string()
      .describe(
        'Complete translation of originalText, including titles and names, into the requested target language using natural wording. Preserve numbers, emoji and nonlinguistic symbols unchanged. Put source-language pronunciation in romanization.',
      ),
    originalLanguageBcp47Code: z
      .string()
      .describe(
        'Regional BCP47 tag of the source language, or number for digits only, symbol for symbols/emoji only, unknown when unidentified.',
      ),
    romanization: z
      .string()
      .nullable()
      .describe(
        'Latin-script transcription of the non-Latin source text in originalText, retaining existing Latin words as written. This field contains pronunciation, not translation. Use null for Latin-only text, numbers or symbols.',
      ),
  })
  .strict();

/** Strict outgoing contract, also serialized into plain generation prompts. */
export function createGenerationResponseSchema(includeDescription = true) {
  const shape = {
    segments: z
      .array(segmentSchema)
      .describe(
        'Ordered source/translation pairs covering all visible text, emoji and symbols, with each region captured once.',
      ),
  };

  const data = includeDescription
    ? z
        .object({
          ...shape,
          description: z
            .string()
            .describe(
              'Compact Markdown in the target language explaining useful meaning, context or nuance beyond the translation. Ground explanations in the selected image and text, identify uncertainty when relevant, and omit unsupported claims and unrelated details. Use paragraphs, bold or lists when helpful; do not use HTML. Use an empty string when nothing needs explanation.',
            ),
        })
        .strict()
    : z.object(shape).strict();

  return z
    .object({
      success: z
        .boolean()
        .describe(
          'True when text, emoji or symbols were captured and translated; false when none could be identified.',
        ),
      error: z
        .string()
        .nullable()
        .describe(
          'Machine-readable error code on failure, such as NO_TEXT_FOUND; null on success.',
        ),
      data: data
        .nullable()
        .describe('The translation result on success; null on failure.'),
    })
    .strict();
}

// Receipt-only schemas tolerate omitted nullable metadata; requests stay strict.
export const pairedResponseSchema = z
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

const legacySegment = z
  .object({
    text: z.string(),
    languageBcp47Code: z.string(),
    language: z.string(),
    romanization: z.string().nullable().default(null),
    blockIndex: blockIndexSchema.default(0),
  })
  .strict();

export const legacyResponseSchema = z
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

export type PairedResponse = z.infer<typeof pairedResponseSchema>;
