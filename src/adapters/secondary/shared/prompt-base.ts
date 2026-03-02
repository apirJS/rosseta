/**
 * Shared translation prompt builder.
 *
 * Contains the core OCR + translation instructions used by all
 * providers. Provider-specific wrappers add schema delivery details.
 */

export interface PromptParams {
  /** BCP-47 code with region, e.g. "en-US" */
  targetLanguageCode: string;
  /** Human-readable name, e.g. "English" */
  targetLanguageName: string;
}

export function buildBasePrompt({
  targetLanguageCode,
  targetLanguageName,
}: PromptParams): string {
  return `**TASK: Exhaustive OCR → JSON → Translation**

Perform **exhaustive** OCR on the provided image. Extract **every single piece of visible text** — headings, labels, buttons, captions, numbers, timestamps, navigation items, watermarks, etc. **Do NOT skip or omit any text**, no matter how small.

**Return EXACTLY ONE JSON object.** No markdown fences, no prose, no extra keys.

**Wrapper contract**
- Success: \`{ "success": true, "data": { ... } }\`
- Failure: \`{ "success": false, "error": "<message>" }\`
- Exactly one of \`data\` or \`error\` — never both.

**Failure cases (return success=false)**
- No human-readable text found → \`error = "NO_TEXT_FOUND"\`.
- Image invalid/unreadable → concise error string.

**Success rules**
1) **Completeness**: capture ALL visible text. Missing text is a critical error.
2) **Reading order**: natural order (LTR/RTL/top-to-bottom). Group contiguous words/lines sharing the same language into one segment. Do NOT invent text.
3) \`originalText.contents[i]\`:
   - \`text\`: exact extracted text (trim ends; preserve meaningful newlines as \\\\n; emojis allowed).
   - \`languageBcp47Code\`: BCP-47 with region (e.g. \`"en-US"\`, \`"ja-JP"\`). Use \`"number"\` for purely numeric segments, \`"symbol"\` for symbol/emoji-only segments, \`"unknown"\` if the language cannot be identified. **Never use \`"und"\` or \`"Undetermined"\`.**
   - \`language\`: English name (e.g. \`"English"\`, \`"Japanese"\`). Use \`"Number"\`, \`"Symbol"\`, or \`"Unknown"\` for the corresponding special codes.
   - \`romanization\`: include only when the source script is non-Latin and a common romanization exists; otherwise \`null\`.
4) \`translatedText.contents[i]\` (index-aligned with originalText):
   - \`text\`: natural, professional translation into ${targetLanguageName}. If source equals target, copy the source text. For \`"number"\` or \`"symbol"\` segments, copy the original text unchanged.
   - \`languageBcp47Code\`: \`"${targetLanguageCode}"\` (or copy the original code for number/symbol segments).
   - \`language\`: \`"${targetLanguageName}"\` (or copy the original name for number/symbol segments).
   - \`romanization\`: \`null\`.
5) \`description\`: 1–3 sentence contextual summary of the extracted text, written in ${targetLanguageName}.

**Example** (image containing "こんにちは" and "3.50"):
\`\`\`json
{"success":true,"data":{"originalText":{"contents":[{"text":"こんにちは","languageBcp47Code":"ja-JP","language":"Japanese","romanization":"konnichiwa"},{"text":"3.50","languageBcp47Code":"number","language":"Number","romanization":null}]},"translatedText":{"contents":[{"text":"Hello","languageBcp47Code":"${targetLanguageCode}","language":"${targetLanguageName}","romanization":null},{"text":"3.50","languageBcp47Code":"number","language":"Number","romanization":null}]},"description":"A Japanese greeting followed by a numeric value."}}
\`\`\`

**Output JSON ONLY.**`;
}
