export interface PromptParams {
  targetLanguageCode: string;
  targetLanguageName: string;
  includeDescription?: boolean;
}

export function buildBasePrompt({
  targetLanguageCode,
  targetLanguageName,
  includeDescription = true,
}: PromptParams): string {
  return `**TASK: Exhaustive OCR → Translation**

Perform **exhaustive** OCR on the provided image. Extract **every single piece of visible text** — headings, labels, buttons, captions, numbers, timestamps, navigation items, watermarks, etc. **Do NOT skip or omit any text**, no matter how small.

**Wrapper contract** — return exactly one JSON object, no markdown fences, no prose, no extra keys:
- Success: \`{ "success": true, "data": { ... } }\`
- Failure: \`{ "success": false, "error": "<message>" }\`
- Exactly one of \`data\` or \`error\` — never both.

**Failure cases (return success=false)**
- No human-readable text found, or text exists but is completely unreadable → \`error = "NO_TEXT_FOUND"\`.
- Image invalid/unreadable → concise error string.
- Never return \`success=true\` with empty \`contents\` arrays. If text is partially legible, extract what you can and ignore the rest.

**Success rules**
1) **Completeness**: capture ALL visible text. Missing text is a critical error.
2) **Segmentation**: each **visually distinct block** of text is its own segment — text that is spatially grouped together AND shares the same purpose (e.g. a headline, a button label, a timestamp, a channel name). Do NOT merge text from different UI elements, cards, or areas into one segment. If a block mixes languages (e.g. "OK ボタン"), split it into one segment per language. Do NOT invent text. Use natural reading order (LTR/RTL/top-to-bottom).
3) \`originalText.contents[i]\`:
   - \`text\`: exact extracted text. Join wrapped lines within the same block with a single space; strip leading/trailing spaces. If a line break is truly needed, write \`\\n\` — never a literal newline inside a JSON string.
   - \`languageBcp47Code\`: BCP-47 with region (e.g. \`"en-US"\`, \`"ja-JP"\`). Use \`"number"\` for purely numeric segments, \`"symbol"\` for symbol/emoji-only segments, \`"unknown"\` if the language cannot be identified. **Never use \`"und"\` or \`"Undetermined"\`.**
   - \`language\`: English name (e.g. \`"English"\`, \`"Japanese"\`). Use \`"Number"\`, \`"Symbol"\`, or \`"Unknown"\` for the corresponding special codes.
   - \`romanization\`: lowercase romanization (e.g. \`"konnichiwa"\`), only when the source script is non-Latin and a common romanization exists; otherwise \`null\`.
4) \`translatedText.contents[i]\` (index-aligned with originalText):
   - \`text\`: natural, professional translation into ${targetLanguageName}. Preserve the casing style of headings and labels (e.g. ALL CAPS, Title Case). Copy verbatim, unchanged: numbers, symbols, dates, times, prices, URLs, code, and identifiers. If source equals target, copy the source text.
   - \`languageBcp47Code\`: \`"${targetLanguageCode}"\` (or copy the original code for number/symbol segments).
   - \`language\`: \`"${targetLanguageName}"\` (or copy the original name for number/symbol segments).
   - \`romanization\`: \`null\`.
5) \`description\`: ${
    includeDescription
      ? `Compact contextual summary of the extracted text, **written in ${targetLanguageName}**. If no context is evident, describe the elements briefly.`
      : `always \`""\` (empty string).`
  }

**Example** (image containing "こんにちは" and "3.50"):
{"success":true,"data":{"originalText":{"contents":[{"text":"こんにちは","languageBcp47Code":"ja-JP","language":"Japanese","romanization":"konnichiwa"},{"text":"3.50","languageBcp47Code":"number","language":"Number","romanization":null}]},"translatedText":{"contents":[{"text":"<こんにちは translated into ${targetLanguageName}>","languageBcp47Code":"${targetLanguageCode}","language":"${targetLanguageName}","romanization":null},{"text":"3.50","languageBcp47Code":"number","language":"Number","romanization":null}]},"description":${
    includeDescription
      ? `"<1–2 sentence summary in ${targetLanguageName}>"`
      : `""`
  }}}

**Example failure** (image with no readable text):
{"success":false,"error":"NO_TEXT_FOUND"}

**Output JSON ONLY.`;
}
