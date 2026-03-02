import { buildBasePrompt, type PromptParams } from '../shared/prompt-base';

/**
 * Builds the Z.ai translation prompt.
 *
 * Z.ai supports `response_format: { type: 'json_schema' }` with a
 * full JSON Schema, so the prompt does not need an inline example.
 */
export function buildZaiTranslationPrompt(params: PromptParams): string {
  return buildBasePrompt(params);
}
