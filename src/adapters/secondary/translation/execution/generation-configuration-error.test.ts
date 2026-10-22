import { describe, expect, test } from 'bun:test';
import {
  APICallError,
  RetryError,
  StreamProviderError,
  UnsupportedFunctionalityError,
} from 'ai';
import {
  isConfigurationModeConflict,
  isConfigurationRejection,
} from './generation-configuration-error';

function api(message: string, statusCode = 400, param?: string): APICallError {
  return new APICallError({
    message: 'Request rejected',
    statusCode,
    url: 'https://fixture.invalid/v1',
    requestBodyValues: {},
    responseBody: JSON.stringify({
      error: { message, param, type: 'invalid_request_error' },
    }),
  });
}

describe('Adapter: generation configuration rejection evidence', () => {
  test.each([
    ['Unsupported parameter', 'reasoning_effort'],
    [
      "Unsupported value: 'none' is not supported with this model",
      'reasoning_effort',
    ],
    ['Invalid value', 'thinking.type'],
    ["Input should be 'enabled' or 'adaptive'", 'thinking.type'],
    ['thinking.type must be enabled for this model', undefined],
    ['thinking must not be disabled', undefined],
    ['This model cannot disable thinking', undefined],
    ['Thinking is mandatory for this model and cannot be disabled', undefined],
    ['Unknown name "thinkingBudget" at generation_config', undefined],
    ['This thinking type is unavailable now', undefined],
    ['reasoning_effort is unimplemented for this model', undefined],
  ] as const)(
    'recognizes explicit rejection of an active control: %s',
    (message, param) => {
      expect(
        isConfigurationRejection(api(message, 400, param), [
          'reasoning_effort',
          'thinking',
          'thinkingBudget',
        ]),
      ).toBe(true);
    },
  );

  test.each([400, 422, 501])(
    'accepts explicit parameter evidence on HTTP %i',
    (status) => {
      expect(
        isConfigurationRejection(
          api('Unsupported parameter', status, 'reasoning_effort'),
          ['reasoning_effort'],
        ),
      ).toBe(true);
    },
  );

  test('accepts typed SDK unsupported-functionality evidence without an HTTP status', () => {
    expect(
      isConfigurationRejection(
        new UnsupportedFunctionalityError({ functionality: 'reasoning' }),
        ['reasoning'],
      ),
    ).toBe(true);

    expect(
      isConfigurationRejection(
        new UnsupportedFunctionalityError({
          functionality: 'reasoning',
          message: 'Request rejected',
        }),
        ['reasoning'],
      ),
    ).toBe(true);

    expect(
      isConfigurationRejection(
        new UnsupportedFunctionalityError({ functionality: 'tools' }),
        ['reasoning'],
      ),
    ).toBe(false);

    expect(
      isConfigurationRejection({ message: 'reasoning is unsupported' }, [
        'reasoning',
      ]),
    ).toBe(false);
  });

  test('unwraps SDK retries and reads nested rejection parameter names', () => {
    const error = new RetryError({
      message: 'Retries exhausted',
      reason: 'errorNotRetryable',
      errors: [api('Unsupported parameter', 400, 'reasoning_effort')],
    });

    expect(isConfigurationRejection(error, ['reasoning_effort'])).toBe(true);
  });

  test('recognizes explicit provider codes naming the rejected active control', () => {
    expect(
      isConfigurationRejection(
        {
          status: 400,
          error: {
            code: 'unsupported_reasoning_effort',
            message: 'Request rejected',
          },
        },
        ['reasoning_effort'],
      ),
    ).toBe(true);
  });

  test.each([0, 200])(
    'accepts explicit typed in-band rejection after HTTP %i without accepting plain prose',
    (status) => {
      const error = {
        status,
        type: 'error',
        code: 'invalid_request_error',
        message: 'Unsupported parameter',
        param: 'reasoning_effort',
      };

      expect(isConfigurationRejection(error, ['reasoning_effort'])).toBe(true);

      expect(
        isConfigurationRejection(
          new StreamProviderError({
            statusCode: status || undefined,
            code: 'invalid_request_error',
            message: 'reasoning_effort is unsupported',
          }),
          ['reasoning_effort'],
        ),
      ).toBe(true);

      expect(
        isConfigurationRejection(
          { status, message: 'reasoning_effort is unsupported' },
          ['reasoning_effort'],
        ),
      ).toBe(false);

      expect(
        isConfigurationRejection(new Error('reasoning_effort is unsupported'), [
          'reasoning_effort',
        ]),
      ).toBe(false);
    },
  );

  test.each([
    'rate_limit_exceeded',
    'invalid_api_key',
    'internal_error',
    'not_a_provider_code',
  ])('does not infer compatibility from unrelated in-band code %s', (code) => {
    expect(
      isConfigurationRejection(
        {
          type: 'error',
          code,
          message: 'Unsupported parameter',
          param: 'reasoning_effort',
        },
        ['reasoning_effort'],
      ),
    ).toBe(false);

    expect(
      isConfigurationRejection(
        new StreamProviderError({
          code,
          message: 'reasoning_effort is unsupported',
        }),
        ['reasoning_effort'],
      ),
    ).toBe(false);
  });

  test('requires explicit request-rejection metadata for an in-band SDK error', () => {
    expect(
      isConfigurationRejection(
        new StreamProviderError({ message: 'reasoning_effort is unsupported' }),
        ['reasoning_effort'],
      ),
    ).toBe(false);

    expect(
      isConfigurationRejection(
        new StreamProviderError({
          message: 'Unsupported parameter',
          data: { type: 'invalid_request_error', param: 'reasoning_effort' },
        }),
        ['reasoning_effort'],
      ),
    ).toBe(true);
  });

  test('recognizes a typed failed provider envelope whose SDK omits the HTTP status', () => {
    expect(
      isConfigurationRejection(
        {
          success: false,
          error: {
            code: 'invalid_request_error',
            message: 'Unsupported parameter',
            param: 'reasoning_effort',
          },
        },
        ['reasoning_effort'],
      ),
    ).toBe(true);

    expect(
      isConfigurationRejection(
        {
          success: false,
          error: { message: 'reasoning_effort is unsupported' },
        },
        ['reasoning_effort'],
      ),
    ).toBe(false);

    expect(
      isConfigurationRejection(
        {
          success: true,
          error: {
            code: 'invalid_request_error',
            message: 'reasoning_effort is unsupported',
          },
        },
        ['reasoning_effort'],
      ),
    ).toBe(false);
  });

  test('does not cache retryable in-band provider failures as rejected controls', () => {
    expect(
      isConfigurationRejection(
        new StreamProviderError({
          code: 'invalid_request_error',
          message: 'reasoning_effort is unsupported',
          isRetryable: true,
        }),
        ['reasoning_effort'],
      ),
    ).toBe(false);
  });

  test('explicit retryability takes precedence over contradictory HTTP 400 control evidence', () => {
    expect(
      isConfigurationRejection(
        new StreamProviderError({
          statusCode: 400,
          code: 'invalid_request_error',
          message: 'reasoning_effort is unsupported',
          isRetryable: true,
        }),
        ['reasoning_effort'],
      ),
    ).toBe(false);
  });

  test('matches provider spelling variants without confusing unrelated fields', () => {
    expect(
      isConfigurationRejection(
        api('thinking budget must be greater than zero'),
        ['thinkingBudget'],
      ),
    ).toBe(true);

    expect(
      isConfigurationRejection(api('Unsupported parameter: thinking_budget'), [
        'thinking.budget',
      ]),
    ).toBe(true);

    expect(
      isConfigurationRejection(
        api('Unsupported parameter: thinkingBudgetExtra'),
        ['thinkingBudget'],
      ),
    ).toBe(false);

    expect(
      isConfigurationRejection(
        api('reasoning_effort is unsupported', 400, 'temperature'),
        ['reasoning_effort'],
      ),
    ).toBe(false);
  });

  test.each([401, 402, 403, 404, 408, 413, 429, 500, 502, 503, 504])(
    'HTTP %i cannot teach configuration incompatibility',
    (status) => {
      expect(
        isConfigurationRejection(
          api('reasoning_effort is unsupported', status),
          ['reasoning_effort'],
        ),
      ).toBe(false);
    },
  );

  test.each([
    'Invalid API key; reasoning_effort is unsupported',
    'reasoning_effort is unavailable for your account',
    'reasoning_effort is not supported on this subscription plan',
    'reasoning_effort is unavailable for this project',
    'reasoning_effort is unsupported on this tier',
    'Rate limit exceeded; reasoning_effort is unsupported',
    'Insufficient credits; reasoning_effort is unsupported',
    'reasoning_effort is temporarily unavailable; try again',
    'The backend is unavailable; reasoning_effort is unsupported',
    'Connection terminated; reasoning_effort is unsupported',
    'Model not found; reasoning_effort is unsupported',
    'Invalid JSON schema: additionalProperties is required; reasoning_effort is unsupported',
    'The schema keyword oneOf is not supported; reasoning_effort is unsupported',
    'Invalid image payload; reasoning_effort is unsupported',
    'The model does not support images; reasoning_effort is unsupported',
    'Context window exceeded; reasoning_effort is unsupported',
    'Content blocked by safety policy; reasoning_effort is unsupported',
  ])('keeps unrelated failure terminal without learning: %s', (message) => {
    expect(isConfigurationRejection(api(message), ['reasoning_effort'])).toBe(
      false,
    );
  });

  test.each([
    'invalid_api_key',
    'rate_limit_exceeded',
    'model_not_found',
    'invalid_image',
    'permission_denied',
    'email_must_be_confirmed',
    'authentication_error',
    'unauthenticated',
    'forbidden',
  ])('does not learn from nested terminal error code %s', (code) => {
    expect(
      isConfigurationRejection(
        {
          statusCode: 400,
          error: {
            code,
            message: 'Unsupported parameter',
            param: 'reasoning_effort',
          },
        },
        ['reasoning_effort'],
      ),
    ).toBe(false);
  });

  test('keeps invalid-schema provider codes outside configuration compatibility', () => {
    expect(
      isConfigurationRejection(
        {
          status: 400,
          error: {
            code: 'invalid_json_schema',
            message: 'reasoning_effort is unsupported',
          },
        },
        ['reasoning_effort'],
      ),
    ).toBe(false);
  });

  test.each([
    'reasoning_effort none is not supported with json_schema',
    'thinking cannot be used in streaming',
    'reasoning_effort is unsupported for response_format=json_schema',
    'thinking must be enabled when stream=true',
    'Streaming is not supported when reasoning_effort is none',
    'json_schema is unavailable while thinking is enabled',
    'thinking is only supported without structured output',
  ])(
    'leaves conditional schema/stream conflicts to generation-mode fallback: %s',
    (message) => {
      expect(
        isConfigurationModeConflict(api(message), [
          'reasoning_effort',
          'thinking',
        ]),
      ).toBe(true);

      expect(
        isConfigurationRejection(api(message), [
          'reasoning_effort',
          'thinking',
        ]),
      ).toBe(false);

      expect(
        isConfigurationRejection(api(message, 400, 'thinking'), ['thinking']),
      ).toBe(false);
    },
  );

  test('mode conflicts require active controls and trustworthy provider rejection evidence', () => {
    const message = 'Streaming is not supported when reasoning_effort is none';

    expect(isConfigurationModeConflict(api(message), [])).toBe(false);
    expect(isConfigurationModeConflict(api(message), ['thinking'])).toBe(false);

    expect(
      isConfigurationModeConflict(new Error(message), ['reasoning_effort']),
    ).toBe(false);

    expect(
      isConfigurationModeConflict(api(message, 429), ['reasoning_effort']),
    ).toBe(false);

    expect(
      isConfigurationModeConflict(api('reasoning_effort is unsupported'), [
        'reasoning_effort',
      ]),
    ).toBe(false);

    expect(
      isConfigurationModeConflict(api('Rate limit exceeded; ' + message), [
        'reasoning_effort',
      ]),
    ).toBe(false);
  });

  test.each(['stream', 'response_format', 'response_format.json_schema'])(
    'recognizes a control-mode conflict reported against feature parameter %s',
    (parameter) => {
      const error = api(
        'Streaming is not supported when reasoning_effort is none',
        400,
        parameter,
      );

      expect(isConfigurationModeConflict(error, ['reasoning_effort'])).toBe(
        true,
      );

      expect(isConfigurationRejection(error, ['reasoning_effort'])).toBe(false);
    },
  );

  test('a feature parameter alone cannot establish a control-mode conflict', () => {
    expect(
      isConfigurationModeConflict(
        api('Streaming is unsupported', 400, 'stream'),
        ['reasoning_effort'],
      ),
    ).toBe(false);

    expect(
      isConfigurationModeConflict(
        api(
          'Streaming is not supported when reasoning_effort is none',
          400,
          'temperature',
        ),
        ['reasoning_effort'],
      ),
    ).toBe(false);

    expect(
      isConfigurationRejection(
        api('reasoning_effort is unsupported', 400, 'response_format'),
        ['reasoning_effort'],
      ),
    ).toBe(false);
  });

  test('requires explicit rejection and active-field evidence outside submitted requests', () => {
    expect(
      isConfigurationRejection(api('reasoning_effort was none'), [
        'reasoning_effort',
      ]),
    ).toBe(false);

    expect(
      isConfigurationRejection(api('Invalid request body'), [
        'reasoning_effort',
      ]),
    ).toBe(false);

    expect(
      isConfigurationRejection(
        api('Unsupported parameter', 400, 'temperature'),
        ['reasoning_effort'],
      ),
    ).toBe(false);

    expect(
      isConfigurationRejection(
        api('Unsupported parameter', 400, 'reasoning_effort'),
        [],
      ),
    ).toBe(false);

    expect(
      isConfigurationRejection(
        {
          status: 400,
          message: 'Unsupported parameter',
          requestBodyValues: {
            reasoning_effort: 'none',
            param: 'reasoning_effort',
          },
        },
        ['reasoning_effort'],
      ),
    ).toBe(false);
  });
});
