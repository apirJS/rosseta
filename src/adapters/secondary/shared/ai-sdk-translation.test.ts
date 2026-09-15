import { describe, expect, test, beforeEach } from 'bun:test';
import { generateTextMock } from '../../../../tests/browser-mock';
import { APICallError, NoOutputGeneratedError } from 'ai';
import { executeTranslation } from './ai-sdk-translation';
import {
  VALID_TRANSLATION_RESPONSE,
  VALID_IMAGE,
  TARGET_LANGUAGE,
} from '../../../../tests/test-fixtures';
import {
  TranslationError,
  NetworkError,
  AppError,
  ErrorCode,
} from '../../../shared/errors';

function fakeModel() {
  return {} as Parameters<typeof executeTranslation>[0];
}

function apiError(statusCode: number): APICallError {
  return new APICallError({
    message: `HTTP ${statusCode}`,
    url: 'https://api.test',
    requestBodyValues: {},
    statusCode,
  });
}

function apiErrorWithMessage(statusCode: number, message: string): APICallError {
  return new APICallError({
    message,
    url: 'https://api.test',
    requestBodyValues: {},
    statusCode,
  });
}

describe('Adapter: ai-sdk-translation', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  test('maps a valid response to a Translation', async () => {
    generateTextMock.mockResolvedValueOnce({
      output: VALID_TRANSLATION_RESPONSE,
    });

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.original[0].text).toBe('こんにちは');
      expect(result.data.translated[0].text).toBe('Hello');
    }
  });

  test('passes an abort signal to generateText', async () => {
    generateTextMock.mockResolvedValueOnce({
      output: VALID_TRANSLATION_RESPONSE,
    });

    await executeTranslation(fakeModel(), VALID_IMAGE, TARGET_LANGUAGE, 'TEST');

    const callArgs = generateTextMock.mock.calls[0][0] as {
      abortSignal?: unknown;
    };
    expect(callArgs?.abortSignal).toBeDefined();
  });

  test('prompt asks for a description summary by default', async () => {
    generateTextMock.mockResolvedValueOnce({
      output: VALID_TRANSLATION_RESPONSE,
    });

    await executeTranslation(fakeModel(), VALID_IMAGE, TARGET_LANGUAGE, 'TEST');

    const callArgs = generateTextMock.mock.calls[0][0] as {
      messages: { content: { text: string }[] }[];
    };
    const prompt = callArgs.messages[0].content[0].text;
    expect(prompt).toContain('Compact contextual summary');
    expect(prompt).not.toContain('"description":""');
  });

  test('prompt requests an empty description when includeDescription is false', async () => {
    generateTextMock.mockResolvedValueOnce({
      output: VALID_TRANSLATION_RESPONSE,
    });

    await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
      false,
    );

    const callArgs = generateTextMock.mock.calls[0][0] as {
      messages: { content: { text: string }[] }[];
    };
    const prompt = callArgs.messages[0].content[0].text;
    expect(prompt).toContain('always `""` (empty string)');
    expect(prompt).toContain('"description":""');
    expect(prompt).not.toContain('1–2 sentence');
  });

  test('maps NO_TEXT_FOUND-style rejection to aiRejected', async () => {
    generateTextMock.mockResolvedValueOnce({
      output: { success: false, error: 'NO_TEXT_FOUND' },
    });

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_AI_REJECTED);
    }
  });

  test('maps schema validation failure to malformedResponse', async () => {
    generateTextMock.mockRejectedValueOnce(
      new NoOutputGeneratedError({
        message: 'no output',
        cause: new Error('schema mismatch'),
      }),
    );

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_MALFORMED_RESPONSE);
    }
  });

  test('maps 429 to rateLimited', async () => {
    generateTextMock.mockRejectedValueOnce(apiError(429));

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_RATE_LIMITED);
    }
  });

  test('maps text-only model rejection to modelNoVision', async () => {
    generateTextMock.mockRejectedValueOnce(
      apiErrorWithMessage(
        400,
        'messages[0].content must be a string',
      ),
    );

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_MODEL_NO_VISION);
      expect(result.error.userMessage).toContain('vision');
    }
  });

  test('maps "does not support images" rejection to modelNoVision', async () => {
    generateTextMock.mockRejectedValueOnce(
      apiErrorWithMessage(
        400,
        'This model does not support images in the input.',
      ),
    );

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_MODEL_NO_VISION);
    }
  });

  test('unrelated 400 stays a generic failure', async () => {
    generateTextMock.mockRejectedValueOnce(apiError(400));

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_FAILED);
    }
  });

  test('maps 401 to failed with credential hint', async () => {
    generateTextMock.mockRejectedValueOnce(apiError(401));

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_FAILED);
      expect(result.error.message).toContain('API key');
    }
  });

  test('maps 404 to failed with model hint', async () => {
    generateTextMock.mockRejectedValueOnce(apiError(404));

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Model not found');
    }
  });

  test('maps 5xx to NetworkError', async () => {
    generateTextMock.mockRejectedValueOnce(apiError(503));

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NetworkError);
      expect(result.error.code).toBe(ErrorCode.NETWORK_SERVER_ERROR);
    }
  });

  test('maps AbortError to NetworkError timeout', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    generateTextMock.mockRejectedValueOnce(abortError);

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    }
  });

  test('passes AppError through unchanged', async () => {
    const appError = TranslationError.invalidImage();
    generateTextMock.mockRejectedValueOnce(appError);

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(appError);
    }
  });

  test('wraps unknown errors via AppError.fromUnknown', async () => {
    generateTextMock.mockRejectedValueOnce('plain string failure');

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AppError);
    }
  });
});
