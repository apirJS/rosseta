import { describe, expect, spyOn, test, beforeEach, afterEach } from 'bun:test';
import { GroqTranslationAdapter } from './GroqTranslationAdapter';
import type { GroqTranslationResponse } from './schema';
import { ErrorCode } from '../../../shared/errors/ErrorCode';
import {
  VALID_TRANSLATION_RESPONSE,
  VALID_IMAGE,
  TARGET_LANGUAGE,
  groqEnvelope,
  createGroqCredential,
  createDefaultPreferences,
} from '../../../../tests/test-fixtures';

// ── Helpers ──────────────────────────────────────────────────────────

function createAdapter() {
  return new GroqTranslationAdapter(
    createGroqCredential(),
    createDefaultPreferences(),
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Adapter: GroqTranslationAdapter', () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test('translates an image successfully', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(groqEnvelope(VALID_TRANSLATION_RESPONSE)), {
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

  test('returns failed error when response has no choices', async () => {
    fetchSpy.mockResolvedValueOnce(Response.json({ choices: [] }));

    const adapter = createAdapter();
    const result = await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_FAILED);
    }
  });

  test('returns malformed response when content is not valid JSON', async () => {
    fetchSpy.mockResolvedValueOnce(
      Response.json({
        choices: [{ message: { content: 'not json at all' } }],
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
        choices: [{ message: { content: JSON.stringify({ garbage: true }) } }],
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
    const rejectedResponse: GroqTranslationResponse = {
      success: false,
      error: 'No text found in image',
      data: null,
    };

    fetchSpy.mockResolvedValueOnce(
      Response.json(groqEnvelope(rejectedResponse)),
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

  test('sends request to Groq API with Bearer auth', async () => {
    fetchSpy.mockResolvedValueOnce(
      Response.json(groqEnvelope(VALID_TRANSLATION_RESPONSE)),
    );

    const adapter = createAdapter();
    await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('api.groq.com');

    const calledOptions = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(calledOptions.method).toBe('POST');
    expect(
      (calledOptions.headers as Record<string, string>).Authorization,
    ).toStartWith('Bearer gsk_');
  });
});
