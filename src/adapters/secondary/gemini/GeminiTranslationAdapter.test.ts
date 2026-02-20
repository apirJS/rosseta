import { describe, expect, spyOn, test, beforeEach, afterEach } from 'bun:test';
import { GeminiTranslationAdapter } from './GeminiTranslationAdapter';
import type { TranslationResponse } from './schema';
import { ErrorCode } from '../../../shared/errors/ErrorCode';
import {
  VALID_TRANSLATION_RESPONSE,
  VALID_IMAGE,
  TARGET_LANGUAGE,
  geminiEnvelope,
  createGeminiCredential,
  createDefaultPreferences,
} from '../../../../tests/test-fixtures';

// ── Helpers ──────────────────────────────────────────────────────────

function createAdapter() {
  return new GeminiTranslationAdapter(
    createGeminiCredential(),
    createDefaultPreferences(),
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Adapter: GeminiTranslationAdapter', () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test('translates an image successfully', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(geminiEnvelope(VALID_TRANSLATION_RESPONSE)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const adapter = createAdapter();
    const result = await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('A greeting in Japanese');
      expect(result.data.original).toHaveLength(1);
      expect(result.data.original[0].text).toBe('こんにちは');
      expect(result.data.translated).toHaveLength(1);
      expect(result.data.translated[0].text).toBe('Hello');
    }
  });

  test('returns rate-limited error on 429', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Too Many Requests', { status: 429 }),
    );

    const adapter = createAdapter();
    const result = await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_RATE_LIMITED);
    }
  });

  test('returns failed error on non-ok status', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );

    const adapter = createAdapter();
    const result = await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_FAILED);
    }
  });

  test('returns failed error when response has no candidates', async () => {
    fetchSpy.mockResolvedValueOnce(Response.json({ candidates: [] }));

    const adapter = createAdapter();
    const result = await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_FAILED);
    }
  });

  test('returns malformed response when text is not valid JSON', async () => {
    fetchSpy.mockResolvedValueOnce(
      Response.json({
        candidates: [{ content: { parts: [{ text: 'not json at all' }] } }],
      }),
    );

    const adapter = createAdapter();
    const result = await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_MALFORMED_RESPONSE);
    }
  });

  test('returns malformed response when JSON fails schema validation', async () => {
    fetchSpy.mockResolvedValueOnce(
      Response.json({
        candidates: [
          { content: { parts: [{ text: JSON.stringify({ garbage: true }) }] } },
        ],
      }),
    );

    const adapter = createAdapter();
    const result = await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_MALFORMED_RESPONSE);
    }
  });

  test('returns ai-rejected error when AI says success=false', async () => {
    const rejectedResponse: TranslationResponse = {
      success: false,
      error: 'No text found in image',
      data: null,
    };

    fetchSpy.mockResolvedValueOnce(
      Response.json(geminiEnvelope(rejectedResponse)),
    );

    const adapter = createAdapter();
    const result = await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_AI_REJECTED);
    }
  });

  test('returns error when fetch throws (network failure)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const adapter = createAdapter();
    const result = await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(result.success).toBe(false);
  });

  test('sends correct URL with API key and model', async () => {
    fetchSpy.mockResolvedValueOnce(
      Response.json(geminiEnvelope(VALID_TRANSLATION_RESPONSE)),
    );

    const adapter = createAdapter();
    await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('generativelanguage.googleapis.com');
    expect(calledUrl).toContain('AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    expect(calledUrl).toContain(':generateContent');
  });
});
