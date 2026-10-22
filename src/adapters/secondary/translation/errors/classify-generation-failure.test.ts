import { describe, expect, test } from 'bun:test';
import {
  APICallError,
  StreamProviderError,
  UnsupportedFunctionalityError,
} from 'ai';
import { classifyGenerationFailure } from './classify-generation-failure';
import type { GenerationMode } from '../transports/generation-modes';
import { ErrorCode, NetworkError } from '../../../../shared/errors';
import { UNAVAILABLE_RESPONSE_FORMAT_ERROR } from '../../../../../tests/fixtures/captured-provider-errors';

function classify(error: unknown, mode: GenerationMode) {
  return classifyGenerationFailure(error, { mode });
}

function api(message: string, statusCode = 400) {
  return new APICallError({
    message,
    statusCode,
    url: 'https://fixture.invalid',
    requestBodyValues: {},
  });
}

describe('Adapter: provider failure evidence', () => {
  test('an adapter timeout preserves its error and allows a transport restart', () => {
    const error = NetworkError.timeout();
    const result = classify(error, 'plain-stream');

    expect(result.error).toBe(error);
    expect(result.kind).toBe('transient');
  });

  test('reads SDK functionality metadata even when a custom message omits it', () => {
    const error = new UnsupportedFunctionalityError({
      functionality: 'json_schema',
      message: 'Request rejected',
    });

    expect(classify(error, 'structured-stream')).toMatchObject({
      kind: 'feature-rejected',
      feature: 'structured',
    });
  });

  test('recognizes explicit feature rejection in a typed successful-HTTP stream error', () => {
    const error = new StreamProviderError({
      statusCode: 200,
      type: 'invalid_request_error',
      message: 'response_format is unsupported',
    });

    expect(classify(error, 'structured-stream')).toMatchObject({
      kind: 'feature-rejected',
      feature: 'structured',
    });
  });

  test('retryable in-band errors restart without teaching model incompatibility', () => {
    const error = new StreamProviderError({
      type: 'invalid_request_error',
      message: 'response_format is unsupported',
      isRetryable: true,
    });

    const result = classify(error, 'structured-stream');

    expect(result.kind).toBe('transient');
  });

  test('plain untyped error prose cannot establish no-vision compatibility', () => {
    const result = classify(
      new Error('This model does not support images'),
      'plain-stream',
    );

    expect(result).toMatchObject({ kind: 'terminal' });
  });

  test.each(['permission_denied', 'access_denied', 'authentication_error'])(
    'keeps terminal nested %s codes ahead of feature evidence',
    (code) => {
      const result = classify(
        {
          status: 400,
          error: { code, message: 'response_format is unsupported' },
        },
        'structured-stream',
      );

      expect(result).toMatchObject({ kind: 'terminal' });
      expect(result.error.isCategory('AUTH')).toBe(true);
    },
  );

  test('an invalid_json_schema code cannot teach structured-output incompatibility', () => {
    const result = classify(
      {
        status: 400,
        error: {
          code: 'invalid_json_schema',
          message: 'response_format is unsupported for this schema',
        },
      },
      'structured-stream',
    );

    expect(result).toMatchObject({ kind: 'terminal' });
  });

  test.each([
    ['context_length_exceeded', ErrorCode.TRANSLATION_CONTEXT_LIMIT],
    ['image_too_large', ErrorCode.TRANSLATION_IMAGE_TOO_LARGE],
    ['payload_too_large', ErrorCode.TRANSLATION_IMAGE_TOO_LARGE],
    ['forbidden', ErrorCode.AUTH_ACCESS_DENIED],
  ])(
    'keeps nested input/access code %s ahead of feature evidence',
    (code, expected) => {
      const result = classify(
        {
          status: 400,
          error: { code, message: 'response_format is unsupported' },
        },
        'structured-stream',
      );

      expect(result).toMatchObject({ kind: 'terminal' });
      expect(result.error.code).toBe(expected);
    },
  );

  test.each([
    [
      'bad_image',
      'Unsupported image input',
      ErrorCode.TRANSLATION_INVALID_IMAGE,
    ],
    [
      'usage_limited',
      'Streaming is unsupported',
      ErrorCode.TRANSLATION_PROVIDER_QUOTA_EXCEEDED,
    ],
  ])(
    'retains terminal normalized code %s ahead of compatibility evidence',
    (code, message, expected) => {
      const result = classify({ status: 400, code, message }, 'plain-stream');

      expect(result.error.code).toBe(expected);
      expect(result).toMatchObject({ kind: 'terminal' });
    },
  );

  test.each([408, 504])(
    'transport HTTP %i timeouts can restart once',
    (status) => {
      const result = classify(api('Request timed out', status), 'plain-stream');

      expect(result.error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
      expect(result.kind).toBe('transient');
    },
  );

  test.each([
    'Structured streaming is not supported',
    'streaming is not supported with response_format',
    'json_schema streaming is not available',
  ])('scopes a combined rejection to the observed mode: %s', (message) => {
    const failure = classify(api(message), 'structured-stream');

    expect(failure).toMatchObject({
      kind: 'mode-rejected',
      mode: 'structured-stream',
    });
  });

  test.each([
    'Invalid JSON schema: additionalProperties is required',
    'response_format schema is invalid',
    'Required properties missing in JSON schema',
  ])('does not persist application schema bugs: %s', (message) => {
    expect(classify(api(message), 'structured-stream')).toMatchObject({
      kind: 'terminal',
    });
  });

  test.each([
    [401, ErrorCode.AUTH_INVALID_API_KEY],
    [402, ErrorCode.AUTH_PAYMENT_REQUIRED],
    [403, ErrorCode.AUTH_ACCESS_DENIED],
    [429, ErrorCode.TRANSLATION_RATE_LIMITED],
  ])(
    'HTTP %i remains terminal even if the text contains unsupported features',
    (status, code) => {
      const failure = classify(
        api('Streaming is unsupported', status as number),
        'structured-stream',
      );

      expect(failure).toMatchObject({ kind: 'terminal' });
      expect(failure.error.code).toBe(code);
    },
  );

  test('definitive no-vision is model evidence while invalid image input is terminal', () => {
    expect(
      classify(api('This model does not support images'), 'plain-buffered'),
    ).toMatchObject({ kind: 'feature-rejected', feature: 'vision' });

    expect(
      classify(api('Invalid image payload'), 'plain-stream'),
    ).toMatchObject({ kind: 'terminal' });
  });

  test.each([
    [
      'Unsupported image input format: image/bmp',
      ErrorCode.TRANSLATION_INVALID_IMAGE,
    ],
    [
      'Unsupported image input media type: image/bmp',
      ErrorCode.TRANSLATION_INVALID_IMAGE,
    ],
    [
      'Image input is unsupported because its dimensions exceed the limit',
      ErrorCode.TRANSLATION_IMAGE_TOO_LARGE,
    ],
  ])(
    'keeps image input rejection terminal before no-vision evidence: %s',
    (message, expected) => {
      const errors = [
        api(message),
        { status: 400, error: { code: 'invalid_request_error', message } },
      ];

      for (const error of errors) {
        const result = classify(error, 'plain-stream');

        expect(result.error.code).toBe(expected);
        expect(result).toMatchObject({ kind: 'terminal' });
      }
    },
  );

  test.each([
    'This model does not support image input',
    'Image input is unsupported by this text-only model',
  ])('retains genuine model no-vision evidence: %s', (message) => {
    expect(classify(api(message), 'plain-stream')).toMatchObject({
      kind: 'feature-rejected',
      feature: 'vision',
    });
  });

  test('duplicated JSON error metadata does not misidentify unsupported schema as an invalid application schema', () => {
    const error = new APICallError({
      message: 'This model does not support response_format json_schema',
      statusCode: 400,
      url: 'https://fixture.invalid',
      requestBodyValues: {},
      responseBody: JSON.stringify({
        error: {
          type: 'invalid_request_error',
          code: 'unsupported_feature',
          message: 'This model does not support response_format json_schema',
        },
      }),
    });

    expect(classify(error, 'structured-stream')).toMatchObject({
      kind: 'feature-rejected',
      feature: 'structured',
    });
  });

  test.each([
    'This response_format type is unavailable now',
    'This model does not support response_format',
    'The json_schema response format is not yet supported',
    'Structured output is unavailable',
    "Structured output isn't available",
    'response_format is not_available',
    'JSON schema is unavailable',
    'JSON-schema is not supported',
    'response format is unavailable',
  ])('recognizes explicit unavailable-format wording: %s', (message) => {
    const result = classify(api(message), 'structured-stream');

    expect(result).toMatchObject({
      kind: 'feature-rejected',
      feature: 'structured',
    });
  });

  test.each([
    {
      statusCode: 400,
      message: 'Request rejected',
      responseBody: JSON.stringify(UNAVAILABLE_RESPONSE_FORMAT_ERROR),
    },
    {
      statusCode: 400,
      message: 'Request rejected',
      data: UNAVAILABLE_RESPONSE_FORMAT_ERROR,
    },
    { status: 400, error: UNAVAILABLE_RESPONSE_FORMAT_ERROR.error },
    {
      statusCode: 400,
      data: { error: { data: UNAVAILABLE_RESPONSE_FORMAT_ERROR } },
    },
  ])(
    'finds captured feature evidence in nested SDK/provider envelopes %#',
    (error) => {
      expect(classify(error, 'structured-stream')).toMatchObject({
        kind: 'feature-rejected',
        feature: 'structured',
      });
    },
  );

  test.each([
    'response_format_unavailable',
    'unsupported_response_format',
    'response_format_not_supported',
  ])(
    'recognizes structured-feature evidence supplied only by a provider code: %s',
    (code) => {
      expect(
        classify(
          { statusCode: 400, error: { code, message: 'Request rejected' } },
          'structured-stream',
        ),
      ).toMatchObject({ kind: 'feature-rejected', feature: 'structured' });
    },
  );

  test.each([
    {
      code: 'invalid_api_key',
      message: 'This response_format type is unavailable now',
      expected: ErrorCode.AUTH_INVALID_API_KEY,
    },
    {
      code: 'rate_limit_exceeded',
      message: 'This response_format type is unavailable now',
      expected: ErrorCode.TRANSLATION_RATE_LIMITED,
    },
    {
      code: 'model_not_found',
      message: 'This response_format type is unavailable now',
      expected: ErrorCode.TRANSLATION_MODEL_NOT_FOUND,
    },
    {
      code: 'invalid_image',
      message: 'This response_format type is unavailable now',
      expected: ErrorCode.TRANSLATION_INVALID_IMAGE,
    },
    {
      code: 'invalid_request_error',
      message: 'Unsupported image format for this response_format',
      expected: ErrorCode.TRANSLATION_INVALID_IMAGE,
    },
    {
      code: 'invalid_request_error',
      message: 'Invalid API key; response_format is unavailable',
      expected: ErrorCode.AUTH_INVALID_API_KEY,
    },
    {
      code: 'invalid_request_error',
      message: 'Rate limit exceeded; response_format is unavailable',
      expected: ErrorCode.TRANSLATION_RATE_LIMITED,
    },
  ])(
    'keeps nested HTTP 400 $code terminal without compatibility learning',
    ({ code, message, expected }) => {
      const error = new APICallError({
        message: 'Request rejected',
        statusCode: 400,
        url: 'https://fixture.invalid',
        requestBodyValues: {},
        responseBody: JSON.stringify({ error: { code, message } }),
      });

      const result = classify(error, 'structured-stream');

      expect(result).toMatchObject({ kind: 'terminal' });
      expect(result.error.code).toBe(expected);
    },
  );

  test.each([
    'response_format type must be json_schema',
    'Unsupported schema keyword oneOf in response_format json_schema',
    'The json_schema property additionalProperties is not supported',
    'Invalid json_schema in response_format; this format is unavailable',
    'The model is unavailable',
    'Malformed request body',
  ])(
    'does not discover provider modes from an unrelated or invalid request: %s',
    (message) => {
      expect(classify(api(message), 'structured-stream')).toMatchObject({
        kind: 'terminal',
      });
    },
  );

  test.each([
    'response_format is not supported for your account',
    'Structured output is unavailable for this API key',
    'Streaming is unavailable on your plan',
    'Your account does not support image input',
    'Vision is unavailable for your subscription',
    'response_format is unavailable for this project',
    'Streaming is not supported on this tier',
  ])(
    'does not share credential access restrictions with other accounts: %s',
    (message) => {
      const result = classify(api(message), 'structured-stream');

      expect(result).toMatchObject({ kind: 'terminal' });
      expect(result.error.code).toBe(ErrorCode.AUTH_ACCESS_DENIED);
    },
  );

  test('does not persist backend downtime as unsupported-format evidence', () => {
    const result = classify(
      api(
        'response_format is temporarily unavailable; service unavailable',
        503,
      ),
      'structured-stream',
    );

    expect(result.kind).toBe('transient');
    expect(result.error.code).toBe(ErrorCode.NETWORK_PROVIDER_UNAVAILABLE);
  });

  test.each([
    'response_format is temporarily unavailable; try again',
    'image input is temporarily unavailable; try again later',
  ])(
    'keeps explicit temporary HTTP 400 outages transient without feature learning: %s',
    (message) => {
      const result = classify(api(message), 'structured-stream');

      expect(result.kind).toBe('transient');
      expect(result.error.code).toBe(ErrorCode.NETWORK_PROVIDER_UNAVAILABLE);
    },
  );
});
