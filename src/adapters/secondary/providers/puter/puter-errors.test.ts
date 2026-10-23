import { describe, expect, test } from 'bun:test';
import { mapPuterError } from './puter-errors';
import { ErrorCode, NetworkError } from '../../../../shared/errors';

describe('Puter error normalization', () => {
  test('token limits are input errors rather than invalid credentials', () => {
    expect(
      mapPuterError({
        code: 'token_limit_exceeded',
        message: 'Maximum input token limit exceeded',
      }).code,
    ).toBe(ErrorCode.TRANSLATION_CONTEXT_LIMIT);
  });

  test.each(['invalid_token', 'token_expired', 'invalid_api_key'])(
    '%s remains an authentication failure without an HTTP status',
    (code) => {
      expect(mapPuterError({ code }).code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
    },
  );

  test('nested HTTP status remains available for transient retry classification', () => {
    expect(
      mapPuterError({
        error: { statusCode: 503, message: 'Vision service unavailable' },
      }),
    ).toMatchObject({
      code: ErrorCode.NETWORK_PROVIDER_UNAVAILABLE,
      context: { status: 503 },
    });
  });

  test.each([
    [400, ErrorCode.TRANSLATION_REQUEST_REJECTED],
    [401, ErrorCode.AUTH_INVALID_API_KEY],
  ])(
    'a successful outer transport status cannot hide nested status %s',
    (status, expected) => {
      expect(
        mapPuterError({
          status: 200,
          error: {
            statusCode: status,
            message: 'The provider rejected the request',
          },
        }).code,
      ).toBe(expected);
    },
  );

  test('a failed outer HTTP status remains authoritative over nested metadata', () => {
    expect(
      mapPuterError({
        status: 503,
        error: {
          statusCode: 401,
          message: 'The provider rejected the request',
        },
      }).code,
    ).toBe(ErrorCode.NETWORK_PROVIDER_UNAVAILABLE);
  });

  test.each([
    [{ code: 'invalid_image_input' }, ErrorCode.TRANSLATION_INVALID_IMAGE],
    [{ message: 'Invalid image input' }, ErrorCode.TRANSLATION_INVALID_IMAGE],
    [
      { message: 'Image input too large' },
      ErrorCode.TRANSLATION_IMAGE_TOO_LARGE,
    ],
    [
      { message: 'Unsupported image format for vision input' },
      ErrorCode.TRANSLATION_INVALID_IMAGE,
    ],
    [
      { message: 'Unsupported image input format: image/bmp' },
      ErrorCode.TRANSLATION_INVALID_IMAGE,
    ],
    [
      {
        message:
          'Image input is unsupported because its dimensions exceed the limit',
      },
      ErrorCode.TRANSLATION_IMAGE_TOO_LARGE,
    ],
    [{ code: 'vision_context_limit' }, ErrorCode.TRANSLATION_CONTEXT_LIMIT],
    [
      { message: 'Vision request rejected by safety policy' },
      ErrorCode.TRANSLATION_CONTENT_BLOCKED,
    ],
  ])(
    'input-specific errors are not missing vision support: %j',
    (error, expected) => {
      expect(mapPuterError(error).code).toBe(expected);
    },
  );

  test.each([
    { code: 'vision_not_supported' },
    { message: 'Image input is not supported for this model' },
    { message: 'This model does not support images' },
    { message: 'This is a text-only model' },
  ])('requires explicit unsupported vision evidence: %j', (error) => {
    expect(mapPuterError(error).code).toBe(
      ErrorCode.TRANSLATION_MODEL_NO_VISION,
    );
  });

  test('nested usage-limit metadata survives an unrelated root metadata object', () => {
    expect(
      mapPuterError({
        metadata: {},
        error: {
          code: 'invalid_request_error',
          message: 'reasoning_effort is unsupported',
          metadata: { usage_limited: true },
        },
      }).code,
    ).toBe(ErrorCode.TRANSLATION_PROVIDER_QUOTA_EXCEEDED);
  });

  test.each([408, 504])('%s remains a timeout', (status) => {
    expect(mapPuterError({ status }).code).toBe(ErrorCode.NETWORK_TIMEOUT);
  });

  test('HTTP payload rejection retains its actionable image error', () => {
    expect(mapPuterError({ status: 413 }).code).toBe(
      ErrorCode.TRANSLATION_IMAGE_TOO_LARGE,
    );
  });

  test('native content filtering is terminal', () => {
    expect(mapPuterError({ code: 'content_filter' }).code).toBe(
      ErrorCode.TRANSLATION_CONTENT_BLOCKED,
    );
  });

  test('already normalized application errors retain their identity and context', () => {
    const error = NetworkError.providerUnavailable(503, 'fixture');

    expect(mapPuterError(error)).toBe(error);
  });
});
