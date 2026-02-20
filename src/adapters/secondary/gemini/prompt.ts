export function buildTranslationPrompt(targetLanguage: string): string {
  return `**TASK: Exhaustive OCR → JSON → Translation (schema-strict, wrapped)**

Perform **exhaustive** OCR on the provided image. You MUST extract **every single piece of visible text** — headings, labels, buttons, captions, numbers, timestamps, navigation items, watermarks, etc. **Do NOT skip or omit any text**, no matter how small or seemingly unimportant.

**Return EXACTLY ONE JSON object** that conforms to the responseSchema. No markdown, no prose, no extra keys, no trailing commas.

**Wrapper contract**
- On success: \`{ "success": true, "data": Data }\`
- On failure: \`{ "success": false, "error": "<message>" }\`
- Exactly one of \`data\` or \`error\` must be present — never both.

**Failure cases (must return success=false)**
- No human-readable text found → \`error = "NO_TEXT_FOUND"\`.
- Image invalid/unreadable → concise error.
- \`${targetLanguage}\` cannot be resolved to a BCP-47 tag with region → concise error.

**Success (data) rules**
1) **Completeness is mandatory**: capture ALL visible text. Missing text is a critical error. Every word, number, label, and symbol visible in the image must be represented.
2) **Reading order**: output items in natural reading order (LTR/RTL/top-to-bottom). Group contiguous words/lines into a single segment when they share the same language. Do **not** invent text.
3) \`originalText.contents[i] = { text, languageBcp47Code, language, romanization? }\`
   - \`text\`: exact extracted text (trim ends; preserve meaningful newlines as \\\\n; emojis allowed).
   - \`languageBcp47Code\`: BCP-47 with region (e.g., \`en-US\`, \`id-ID\`, \`ja-JP\`). If region uncertain, pick a common default. Special codes: \`"number"\` for purely numeric segments (e.g., "3.50"), \`"symbol"\` for symbol/punctuation/emoji-only segments, \`"unknown"\` if the language truly cannot be identified. Text containing words (even loanwords like "Live", "Video") should always get a real language code. **NEVER use \`"und"\` or \`"Undetermined"\` — always use \`"unknown"\` / \`"Unknown"\` instead.**
   - \`language\`: human-readable English name (e.g., \`English\`, \`Indonesian\`). Use \`"Number"\`, \`"Symbol"\`, or \`"Unknown"\` for the corresponding special codes.
   - \`romanization\`: include **only** when the **source** script is non-Latin and a common romanization exists; otherwise set to null.
4) \`translatedText.contents[i] = { text, languageBcp47Code, language, romanization? }\` (index-aligned with \`originalText.contents\`).
   - \`text\`: natural, professional translation into \`${targetLanguage}\`. If source equals target, copy source text.
   - \`languageBcp47Code\`: the BCP-47 code corresponding to \`${targetLanguage}\`.
   - \`language\`: \`${targetLanguage}\`.
   - \`romanization\`: include only if the **target** script is non-Latin and romanization is meaningful; otherwise set to null.
5) \`description\`: a brief (1-3 sentence) contextual description of the extracted text, **written in \`${targetLanguage}\`** — explain what the text is about, its context or purpose. Keep it concise and informative.

**Output JSON ONLY.**`;
}
