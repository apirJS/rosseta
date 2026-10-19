import { describe, expect, test } from 'bun:test';
import { APICallError } from 'ai';
import { classifyGenerationError } from './generation-errors';
import { ErrorCode } from '../../../shared/errors';
import { UNAVAILABLE_RESPONSE_FORMAT_ERROR } from '../../../../tests/fixtures/captured-provider-errors';

function api(message: string, statusCode = 400) { return new APICallError({ message, statusCode, url: 'https://fixture.invalid', requestBodyValues: {} }); }
describe('Adapter: provider failure evidence', () => {
  test.each(['Structured streaming is not supported', 'streaming is not supported with response_format', 'json_schema streaming is not available'])('scopes a combined rejection to the observed mode: %s', message => {
    const failure = classifyGenerationError(api(message), 'structured-stream');
    expect(failure.unsupported).toBe('combination');
    expect(failure.general).not.toBe(true);
  });
  test.each(['Invalid JSON schema: additionalProperties is required', 'response_format schema is invalid', 'Required properties missing in JSON schema'])('does not persist application schema bugs: %s', message => {
    expect(classifyGenerationError(api(message), 'structured-stream').unsupported).toBeUndefined();
  });
  test.each([[401, ErrorCode.AUTH_INVALID_API_KEY], [402, ErrorCode.AUTH_PAYMENT_REQUIRED], [403, ErrorCode.AUTH_ACCESS_DENIED], [429, ErrorCode.TRANSLATION_RATE_LIMITED]])('HTTP %i remains terminal even if the text contains unsupported features', (status, code) => {
    const failure = classifyGenerationError(api('Streaming is unsupported', status as number), 'structured-stream');
    expect(failure.unsupported).toBeUndefined();
    expect(failure.error.code).toBe(code);
  });
  test('definitive no-vision is model evidence while invalid image input is terminal', () => {
    expect(classifyGenerationError(api('This model does not support images'), 'plain-buffered').unsupported).toBe('vision');
    expect(classifyGenerationError(api('Invalid image payload'), 'plain-stream').unsupported).toBeUndefined();
  });
  test('duplicated JSON error metadata does not misidentify unsupported schema as an invalid application schema', () => {
    const error = new APICallError({ message: 'This model does not support response_format json_schema', statusCode: 400, url: 'https://fixture.invalid', requestBodyValues: {}, responseBody: JSON.stringify({ error: { type: 'invalid_request_error', code: 'unsupported_feature', message: 'This model does not support response_format json_schema' } }) });
    expect(classifyGenerationError(error, 'structured-stream').unsupported).toBe('structured');
  });
  test.each(['This response_format type is unavailable now', 'This model does not support response_format', 'The json_schema response format is not yet supported', 'Structured output is unavailable', "Structured output isn't available", 'response_format is not_available', 'JSON schema is unavailable', 'JSON-schema is not supported', 'response format is unavailable'])('recognizes explicit unavailable-format wording: %s', message => {
    const result = classifyGenerationError(api(message), 'structured-stream');
    expect(result.unsupported).toBe('structured');
    expect(result.general).toBe(true);
  });
  test.each([
    { statusCode: 400, message: 'Request rejected', responseBody: JSON.stringify(UNAVAILABLE_RESPONSE_FORMAT_ERROR) },
    { statusCode: 400, message: 'Request rejected', data: UNAVAILABLE_RESPONSE_FORMAT_ERROR },
    { status: 400, error: UNAVAILABLE_RESPONSE_FORMAT_ERROR.error },
    { statusCode: 400, data: { error: { data: UNAVAILABLE_RESPONSE_FORMAT_ERROR } } },
  ])('finds captured feature evidence in nested SDK/provider envelopes %#', error => {
    expect(classifyGenerationError(error, 'structured-stream').unsupported).toBe('structured');
  });
  test.each(['response_format_unavailable', 'unsupported_response_format', 'response_format_not_supported'])('recognizes structured-feature evidence supplied only by a provider code: %s', code => {
    expect(classifyGenerationError({ statusCode: 400, error: { code, message: 'Request rejected' } }, 'structured-stream').unsupported).toBe('structured');
  });
  test.each([
    { code: 'invalid_api_key', message: 'This response_format type is unavailable now', expected: ErrorCode.AUTH_INVALID_API_KEY },
    { code: 'rate_limit_exceeded', message: 'This response_format type is unavailable now', expected: ErrorCode.TRANSLATION_RATE_LIMITED },
    { code: 'model_not_found', message: 'This response_format type is unavailable now', expected: ErrorCode.TRANSLATION_MODEL_NOT_FOUND },
    { code: 'invalid_image', message: 'This response_format type is unavailable now', expected: ErrorCode.TRANSLATION_INVALID_IMAGE },
    { code: 'invalid_request_error', message: 'Unsupported image format for this response_format', expected: ErrorCode.TRANSLATION_INVALID_IMAGE },
    { code: 'invalid_request_error', message: 'Invalid API key; response_format is unavailable', expected: ErrorCode.AUTH_INVALID_API_KEY },
    { code: 'invalid_request_error', message: 'Rate limit exceeded; response_format is unavailable', expected: ErrorCode.TRANSLATION_RATE_LIMITED },
  ])('keeps nested HTTP 400 $code terminal without compatibility learning', ({ code, message, expected }) => {
    const error = new APICallError({ message: 'Request rejected', statusCode: 400, url: 'https://fixture.invalid', requestBodyValues: {}, responseBody: JSON.stringify({ error: { code, message } }) });
    const result = classifyGenerationError(error, 'structured-stream');
    expect(result.unsupported).toBeUndefined();
    expect(result.error.code).toBe(expected);
  });
  test.each([
    'response_format type must be json_schema',
    'Unsupported schema keyword oneOf in response_format json_schema',
    'The json_schema property additionalProperties is not supported',
    'Invalid json_schema in response_format; this format is unavailable',
    'The model is unavailable',
    'Malformed request body',
  ])('does not discover provider modes from an unrelated or invalid request: %s', message => {
    expect(classifyGenerationError(api(message), 'structured-stream').unsupported).toBeUndefined();
  });
  test.each(['response_format is not supported for your account', 'Structured output is unavailable for this API key', 'Streaming is unavailable on your plan', 'Your account does not support image input', 'Vision is unavailable for your subscription'])('does not share credential access restrictions with other accounts: %s', message => {
    const result = classifyGenerationError(api(message), 'structured-stream');
    expect(result.unsupported).toBeUndefined();
    expect(result.error.code).toBe(ErrorCode.AUTH_ACCESS_DENIED);
  });
  test('does not persist backend downtime as unsupported-format evidence', () => {
    const result = classifyGenerationError(api('response_format is temporarily unavailable; service unavailable', 503), 'structured-stream');
    expect(result.unsupported).toBeUndefined();
    expect(result.transient).toBe(true);
    expect(result.error.code).toBe(ErrorCode.NETWORK_PROVIDER_UNAVAILABLE);
  });
  test.each(['response_format is temporarily unavailable; try again', 'image input is temporarily unavailable; try again later'])('keeps explicit temporary HTTP 400 outages transient without feature learning: %s', message => {
    const result = classifyGenerationError(api(message), 'structured-stream');
    expect(result.unsupported).toBeUndefined();
    expect(result.transient).toBe(true);
    expect(result.error.code).toBe(ErrorCode.NETWORK_PROVIDER_UNAVAILABLE);
  });
});
