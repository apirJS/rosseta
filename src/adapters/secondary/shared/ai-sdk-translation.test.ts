import { describe, expect, test, beforeEach } from 'bun:test';
import { generateTextMock } from '../../../../tests/browser-mock';
import {
  APICallError,
  NoOutputGeneratedError,
  NoObjectGeneratedError,
} from 'ai';
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
  StorageError,
} from '../../../shared/errors';
import { FakeStructuredOutputExemptionStorage } from '../../../../tests/fakes/FakeStructuredOutputExemptionStorage';
import { failure } from '../../../shared/types/Result';

const GROQ_RESPONSE_FORMAT_ERROR =
  'This model does not support response format `json_schema`. See supported models at https://console.groq.com/docs/structured-outputs#supported-models';

function fakeModel(overrides: { provider?: string; modelId?: string } = {}) {
  return {
    provider: 'test-provider',
    modelId: 'test-model',
    ...overrides,
  } as Parameters<typeof executeTranslation>[0];
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

function apiErrorWithoutStatus(message: string): APICallError {
  return new APICallError({
    message,
    url: 'https://api.test',
    requestBodyValues: {},
  });
}

function noObjectGeneratedError(text: string): NoObjectGeneratedError {
  return new NoObjectGeneratedError({
    message: 'No object generated: response did not match schema.',
    cause: new Error('schema mismatch'),
    text,
    response: {} as never,
    usage: {} as never,
    finishReason: 'stop',
  });
}

function foreignApiError(message: string, statusCode?: number): APICallError {
  const fields: Record<string, unknown> = {
    name: 'AI_APICallError',
    url: 'https://api.test',
    requestBodyValues: {},
  };
  if (statusCode !== undefined) {
    fields.statusCode = statusCode;
  }
  const error = Object.assign(
    new Error(message),
    fields,
  ) as unknown as APICallError;
  Object.defineProperty(error, Symbol.for('vercel.ai.error.AI_APICallError'), {
    value: true,
  });
  return error;
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
      instructions: string;
    };
    const systemPrompt = callArgs.instructions;
    expect(systemPrompt).toContain('compact contextual summary');
    expect(systemPrompt).toContain('"description":"..."');
    expect(systemPrompt).not.toContain('"description":""');
  });

  test('prompt omits the description field entirely when includeDescription is false', async () => {
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
      instructions: string;
    };
    const systemPrompt = callArgs.instructions;
    expect(systemPrompt).not.toContain('description');
    expect(systemPrompt).toContain(
      '{"originalText":{"contents":[ENTRY,...]},"translatedText":{"contents":[ENTRY,...]}}',
    );
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

  test('recovers a fenced response that omits the error key via manual parsing', async () => {
    const payload = JSON.stringify({
      success: true,
      data: VALID_TRANSLATION_RESPONSE.data,
    });
    generateTextMock.mockRejectedValueOnce(
      noObjectGeneratedError('```json\n' + payload + '\n```'),
    );

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

  test('maps unrecoverable NoObjectGeneratedError to malformedResponse', async () => {
    generateTextMock
      .mockRejectedValueOnce(
        noObjectGeneratedError('Sorry, I cannot process this image.'),
      )
      .mockResolvedValueOnce({ text: 'Still not JSON.' });

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
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  test('repairs an unparseable structured response with a follow-up call', async () => {
    const payload =
      '```json\n' + JSON.stringify(VALID_TRANSLATION_RESPONSE) + '\n```';
    generateTextMock
      .mockRejectedValueOnce(
        noObjectGeneratedError('Here is the answer, definitely not JSON'),
      )
      .mockResolvedValueOnce({ text: payload });

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
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    const repairCall = generateTextMock.mock.calls[1][0] as {
      output?: unknown;
    };
    expect(repairCall.output).toBeUndefined();
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

  test('maps "only supports text input" rejection to modelNoVision', async () => {
    generateTextMock.mockRejectedValueOnce(
      apiErrorWithMessage(
        400,
        "Upstream request failed: [400] Model only supports text input; received unsupported content type 'image_url'.",
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

  test('maps any 400/422 mentioning images to modelNoVision', async () => {
    generateTextMock.mockRejectedValueOnce(
      apiErrorWithMessage(422, "Invalid image_url payload in messages[0]"),
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

  test('maps image-mentioning errors without a status code to modelNoVision', async () => {
    generateTextMock.mockRejectedValueOnce(
      apiErrorWithoutStatus(
        "Error from provider (Console): Upstream request failed: [400] Model only supports text input; received unsupported content type 'image_url'.",
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
      expect(result.error.userMessage).toContain('cannot read images');
    }
  });

  test('maps relay-wrapped upstream vision rejections returned as 5xx to modelNoVision', async () => {
    generateTextMock.mockRejectedValueOnce(
      apiErrorWithMessage(
        502,
        'Upstream request failed: [400] Model only supports text input.',
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

  test('maps a foreign-class APICallError mentioning images to modelNoVision', async () => {
    generateTextMock.mockRejectedValueOnce(
      foreignApiError('No endpoints found that support image input', 404),
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

  test('unrelated 400 stays a generic failure without retry or exemption', async () => {
    const exemptions = new FakeStructuredOutputExemptionStorage();
    generateTextMock.mockRejectedValueOnce(apiError(400));

    const result = await executeTranslation(
      fakeModel(),
      VALID_IMAGE,
      TARGET_LANGUAGE,
      'TEST',
      true,
      exemptions,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_FAILED);
    }
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(exemptions.exemptCalls).toEqual([]);
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

  describe('json_schema response-format fallback', () => {
    test('retries without response_format when the API rejects json_schema, and caches the model', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      const payload = '```json\n' + JSON.stringify(VALID_TRANSLATION_RESPONSE) + '\n```';
      generateTextMock
        .mockRejectedValueOnce(apiErrorWithMessage(400, GROQ_RESPONSE_FORMAT_ERROR))
        .mockResolvedValueOnce({ text: payload });

      const result = await executeTranslation(
        fakeModel(),
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.original[0].text).toBe('こんにちは');
        expect(result.data.translated[0].text).toBe('Hello');
      }
      expect(generateTextMock).toHaveBeenCalledTimes(2);

      const firstCall = generateTextMock.mock.calls[0][0] as { output?: unknown };
      const secondCall = generateTextMock.mock.calls[1][0] as { output?: unknown };
      expect(firstCall.output).toBeDefined();
      expect(secondCall.output).toBeUndefined();

      expect(exemptions.isExemptCalls).toEqual(['test-provider:test-model']);
      expect(exemptions.exemptCalls).toEqual(['test-provider:test-model']);
      expect(exemptions.isExempted('test-provider:test-model')).toBe(true);
    });

    test('retries on a status-less relay error mentioning response_format', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      generateTextMock
        .mockRejectedValueOnce(
          apiErrorWithoutStatus(
            'Upstream request failed: [400] response_format json_schema is not supported for this model',
          ),
        )
        .mockResolvedValueOnce({
          text: JSON.stringify(VALID_TRANSLATION_RESPONSE),
        });

      const result = await executeTranslation(
        fakeModel(),
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(true);
      expect(generateTextMock).toHaveBeenCalledTimes(2);
      expect(exemptions.exemptCalls).toEqual(['test-provider:test-model']);
    });

    test('falls back from a foreign-class response-format rejection', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      generateTextMock
        .mockRejectedValueOnce(foreignApiError(GROQ_RESPONSE_FORMAT_ERROR, 400))
        .mockResolvedValueOnce({
          text: JSON.stringify(VALID_TRANSLATION_RESPONSE),
        });

      const result = await executeTranslation(
        fakeModel(),
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(true);
      expect(generateTextMock).toHaveBeenCalledTimes(2);
      expect(exemptions.exemptCalls).toEqual(['test-provider:test-model']);
    });

    test('maps a foreign-class 429 to rateLimited', async () => {
      generateTextMock.mockRejectedValueOnce(foreignApiError('Too many requests', 429));

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

    test('skips the structured attempt for a cached-exempt model', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      exemptions.seedExempt('test-provider:test-model');
      generateTextMock.mockResolvedValueOnce({
        text: JSON.stringify(VALID_TRANSLATION_RESPONSE),
      });

      const result = await executeTranslation(
        fakeModel(),
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.translated[0].text).toBe('Hello');
      }
      expect(generateTextMock).toHaveBeenCalledTimes(1);
      const call = generateTextMock.mock.calls[0][0] as { output?: unknown };
      expect(call.output).toBeUndefined();
      expect(exemptions.exemptCalls).toEqual([]);
    });

    test('maps an AI rejection returned by the plain retry', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      generateTextMock
        .mockRejectedValueOnce(apiErrorWithMessage(400, GROQ_RESPONSE_FORMAT_ERROR))
        .mockResolvedValueOnce({
          text: '{"success":false,"error":"NO_TEXT_FOUND"}',
        });

      const result = await executeTranslation(
        fakeModel(),
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.TRANSLATION_AI_REJECTED);
      }
    });

    test('maps a non-JSON plain retry to malformedResponse', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      generateTextMock
        .mockRejectedValueOnce(apiErrorWithMessage(400, GROQ_RESPONSE_FORMAT_ERROR))
        .mockResolvedValueOnce({ text: 'Sorry, I cannot process this image.' });

      const result = await executeTranslation(
        fakeModel(),
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.TRANSLATION_MALFORMED_RESPONSE);
      }
    });

    test('maps errors thrown by the plain retry through the shared chain', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      generateTextMock
        .mockRejectedValueOnce(apiErrorWithMessage(400, GROQ_RESPONSE_FORMAT_ERROR))
        .mockRejectedValueOnce(apiError(429));

      const result = await executeTranslation(
        fakeModel(),
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.TRANSLATION_RATE_LIMITED);
      }
    });

    test('falls through to the structured attempt when the cache read fails', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      exemptions.failNextCallWith(StorageError.readFailed('exemptions'));
      generateTextMock.mockResolvedValueOnce({
        output: VALID_TRANSLATION_RESPONSE,
      });

      const result = await executeTranslation(
        fakeModel(),
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(true);
      expect(generateTextMock).toHaveBeenCalledTimes(1);
      const call = generateTextMock.mock.calls[0][0] as { output?: unknown };
      expect(call.output).toBeDefined();
      expect(exemptions.exemptCalls).toEqual([]);
    });

    test('still uses structured output for models without provider/modelId', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      generateTextMock.mockResolvedValueOnce({
        output: VALID_TRANSLATION_RESPONSE,
      });

      const result = await executeTranslation(
        {} as Parameters<typeof executeTranslation>[0],
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(true);
      expect(exemptions.isExemptCalls).toEqual([]);
    });

    test('caches the exemption when a manual JSON recovery succeeds', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      generateTextMock.mockRejectedValueOnce(
        noObjectGeneratedError(JSON.stringify(VALID_TRANSLATION_RESPONSE)),
      );

      const result = await executeTranslation(
        fakeModel(),
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(true);
      expect(exemptions.exemptCalls).toEqual(['test-provider:test-model']);
      expect(exemptions.isExempted('test-provider:test-model')).toBe(true);
    });

    test('keeps a recovered translation when the exemption write fails', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      generateTextMock.mockRejectedValueOnce(
        noObjectGeneratedError(JSON.stringify(VALID_TRANSLATION_RESPONSE)),
      );

      const originalExemptModel = exemptions.exemptModel.bind(exemptions);
      exemptions.exemptModel = async (modelKey: string) => {
        await originalExemptModel(modelKey);
        return failure(StorageError.writeFailed('exemptions'));
      };

      const result = await executeTranslation(
        fakeModel(),
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.translated[0].text).toBe('Hello');
      }
      expect(exemptions.exemptCalls).toEqual(['test-provider:test-model']);
    });

    test('does not cache an exemption when the response needs a repair retry', async () => {
      const exemptions = new FakeStructuredOutputExemptionStorage();
      generateTextMock
        .mockRejectedValueOnce(
          noObjectGeneratedError('Sorry, I cannot process this image.'),
        )
        .mockResolvedValueOnce({
          text: JSON.stringify(VALID_TRANSLATION_RESPONSE),
        });

      const result = await executeTranslation(
        fakeModel(),
        VALID_IMAGE,
        TARGET_LANGUAGE,
        'TEST',
        true,
        exemptions,
      );

      expect(result.success).toBe(true);
      expect(generateTextMock).toHaveBeenCalledTimes(2);
      expect(exemptions.exemptCalls).toEqual([]);
    });
  });
});
