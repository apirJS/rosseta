import { describe, expect, test } from 'bun:test';
import { readGenerationErrorDetails } from './provider-error-details';

describe('Adapter: generation error details', () => {
  test('prefers a nested error status over a successful HTTP envelope', () => {
    const details = readGenerationErrorDetails({
      statusCode: 200,
      error: { status: 429, message: 'Too many requests' },
    });

    expect(details.status).toBe(429);
  });

  test('retains a failed HTTP status over nested contradictory error metadata', () => {
    const details = readGenerationErrorDetails({
      statusCode: 503,
      error: { status: 400, message: 'response_format is unsupported' },
    });

    expect(details.status).toBe(503);
  });

  test('collects rejected parameter names from known nested provider envelopes', () => {
    const details = readGenerationErrorDetails({
      statusCode: 400,
      message: 'Request rejected',
      responseBody: JSON.stringify({
        error: {
          message: 'Unsupported parameter',
          param: 'reasoning_effort',
          data: { parameter: 'thinking.type', param: 'reasoning_effort' },
        },
      }),
    });

    expect(details.status).toBe(400);
    expect(details.message).toContain('Unsupported parameter');
    expect(details.parameters).toEqual(['reasoning_effort', 'thinking.type']);
  });

  test('does not inspect request bodies, headers, metadata, or arbitrary response fields', () => {
    const details = readGenerationErrorDetails({
      status: 400,
      message: 'Unsupported parameter',
      requestBodyValues: { param: 'reasoning_effort' },
      request: { parameter: 'thinking' },
      headers: { param: 'thinking_budget' },
      metadata: { parameter: 'reasoning' },
      data: { response: { param: 'enable_thinking' } },
    });

    expect(details.parameters).toEqual([]);
    expect(details.message).toBe('Unsupported parameter');
  });

  test('ignores invalid parameter metadata and terminates circular envelopes', () => {
    const error: Record<string, unknown> = {
      status: 422,
      message: 'Invalid value',
      param: null,
      parameter: ['thinking'],
    };

    error.error = error;
    expect(readGenerationErrorDetails(error).parameters).toEqual([]);
  });
});
