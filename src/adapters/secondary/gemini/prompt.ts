import { buildBasePrompt, type PromptParams } from '../shared/prompt-base';

/**
 * Builds the Gemini translation prompt.
 *
 * Gemini uses responseSchema for structured output, so the prompt
 * only needs the core instructions without an inline schema example.
 */
export function buildTranslationPrompt(params: PromptParams): string {
  return `${buildBasePrompt(params)}

Conform to the provided responseSchema.`;
}
