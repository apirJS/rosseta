import { buildBasePrompt, type PromptParams } from '../shared/prompt-base';

const SCHEMA_EXAMPLE = `{
  "success": true,
  "data": {
    "originalText": {
      "contents": [
        { "text": "...", "languageBcp47Code": "...", "language": "...", "romanization": null }
      ]
    },
    "translatedText": {
      "contents": [
        { "text": "...", "languageBcp47Code": "...", "language": "...", "romanization": null }
      ]
    },
    "description": "..."
  }
}`;

/**
 * Builds the Groq translation prompt.
 *
 * Groq uses `response_format: { type: 'json_object' }` instead of
 * a native schema, so the prompt includes an inline schema example.
 */
export function buildGroqTranslationPrompt(params: PromptParams): string {
  return `${buildBasePrompt(params)}

**Schema:**
\`\`\`json
${SCHEMA_EXAMPLE}
\`\`\``;
}
