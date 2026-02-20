import { describe, expect, spyOn, test, beforeEach, afterEach } from 'bun:test';
import { HttpApiKeyValidator } from './HttpApiKeyValidator';
import { ErrorCode } from '../../../shared/errors/ErrorCode';

describe('Adapter: HttpApiKeyValidator', () => {
  const validator = new HttpApiKeyValidator();
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ══════════════════════════════════════════════════════════════
  // Gemini key validation
  // ══════════════════════════════════════════════════════════════
  describe('Gemini key validation', () => {
    test('succeeds with valid key (200 + models array)', async () => {
      fetchSpy.mockResolvedValueOnce(
        Response.json({ models: [{ name: 'gemini-pro' }] }),
      );

      const result = await validator.validate('AIzaTestKey', 'gemini');
      expect(result.success).toBe(true);
    });

    test('fails with invalid key (400)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'API key not valid' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await validator.validate('AIzaBadKey', 'gemini');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
      }
    });

    test('fails with forbidden key (403)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Forbidden' } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await validator.validate('AIzaForbidden', 'gemini');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
      }
    });

    test('fails with unexpected response format', async () => {
      fetchSpy.mockResolvedValueOnce(Response.json({ something: 'else' }));

      const result = await validator.validate('AIzaWeirdKey', 'gemini');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
      }
    });

    test('returns server error on 500', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Server Error', { status: 500 }),
      );

      const result = await validator.validate('AIzaTestKey', 'gemini');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.NETWORK_SERVER_ERROR);
      }
    });

    test('returns network error on fetch failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('DNS resolution failed'));

      const result = await validator.validate('AIzaTestKey', 'gemini');
      expect(result.success).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Groq key validation
  // ══════════════════════════════════════════════════════════════
  describe('Groq key validation', () => {
    test('succeeds with valid key (200)', async () => {
      fetchSpy.mockResolvedValueOnce(
        Response.json({ choices: [{ message: { content: 'echo' } }] }),
      );

      const result = await validator.validate('gsk_validKey', 'groq');
      expect(result.success).toBe(true);
    });

    test('fails with invalid key (401)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'Invalid API Key' } }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await validator.validate('gsk_badKey', 'groq');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
      }
    });

    test('fails with forbidden key (403)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Forbidden' } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await validator.validate('gsk_forbidden', 'groq');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
      }
    });

    test('fails with rate limited (429)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await validator.validate('gsk_rateLimited', 'groq');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.NETWORK_SERVER_ERROR);
      }
    });

    test('returns server error on 500', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Server Error', { status: 500 }),
      );

      const result = await validator.validate('gsk_testKey', 'groq');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.NETWORK_SERVER_ERROR);
      }
    });

    test('returns network error on fetch failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      const result = await validator.validate('gsk_testKey', 'groq');
      expect(result.success).toBe(false);
    });

    test('sends POST with Bearer token to Groq URL', async () => {
      fetchSpy.mockResolvedValueOnce(
        Response.json({ choices: [{ message: { content: 'echo' } }] }),
      );

      await validator.validate('gsk_myKey', 'groq');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('api.groq.com');

      const calledOptions = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(calledOptions.method).toBe('POST');
      expect(
        (calledOptions.headers as Record<string, string>).Authorization,
      ).toBe('Bearer gsk_myKey');
    });
  });
});
