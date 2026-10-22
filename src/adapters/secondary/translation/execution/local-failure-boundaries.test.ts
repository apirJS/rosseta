import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { APICallError } from 'ai';
import {
  TARGET_LANGUAGE,
  VALID_IMAGE,
  VALID_PAIRED_TRANSLATION_RESPONSE,
} from '../../../../../tests/test-fixtures';
import { FakeStreamingGeneration } from '../../../../../tests/fakes/FakeStreamingGeneration';
import { FakeTranslationCapabilityStorage } from '../../../../../tests/fakes/FakeTranslationCapabilityStorage';
import { Language } from '../../../../core/domain/translation/Language';
import type { TranslationExecutionOptions } from '../../../../core/ports/outbound/TranslationExecutionOptions';
import { AppError, ErrorCode, NetworkError } from '../../../../shared/errors';
import { failure, success } from '../../../../shared/types/Result';
import { TranslationCapabilityState } from '../compatibility/TranslationCapabilityState';
import { executeTranslation } from '../execute-translation';
import type { GenerationResult } from '../transports/GenerationTransport';

const context = {
  providerId: 'test',
  modelId: 'vision',
  protocol: 'test',
  baseURL: 'https://local-failures.invalid/v1',
};

const valid: GenerationResult = {
  text: JSON.stringify(VALID_PAIRED_TRANSLATION_RESPONSE),
  output: VALID_PAIRED_TRANSLATION_RESPONSE,
  finishReason: 'stop',
  schemaValidated: true,
};

function run(
  transport: FakeStreamingGeneration,
  options: TranslationExecutionOptions = {},
) {
  return executeTranslation(
    transport,
    context,
    VALID_IMAGE,
    TARGET_LANGUAGE,
    true,
    new FakeTranslationCapabilityStorage(),
    options,
  );
}

function expectLocalFailure(
  result: Awaited<ReturnType<typeof executeTranslation>>,
  original: Error,
): void {
  expect(result.success).toBe(false);

  if (result.success) throw new Error('Expected a local failure');

  if (original instanceof AppError) {
    expect(result.error).toBe(original);
  } else {
    expect(result.error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(result.error.cause).toBe(original);
  }
}

describe('Adapter: local failures stay outside provider recovery', () => {
  afterEach(() => mock.restore());

  test('a failed reset returns its exact application error before generation', async () => {
    const error = NetworkError.connectionFailed();
    const transport = new FakeStreamingGeneration([{ result: valid }]);

    const result = await run(transport, {
      progress: { report: async () => failure(error) },
    });

    expectLocalFailure(result, error);
    expect(transport.requests).toHaveLength(0);
  });

  test.each(['reset', 'snapshot'] as const)(
    'an unexpected %s delivery failure retains its cause without a provider retry',
    async (failedKind) => {
      const error = new TypeError('Local delivery connection failed');
      const reported: string[] = [];

      const transport = new FakeStreamingGeneration([
        {
          events: [
            { type: 'partial', value: VALID_PAIRED_TRANSLATION_RESPONSE },
          ],
          result: valid,
        },
        { result: valid },
      ]);

      const result = await run(transport, {
        progress: {
          report: async (progress) => {
            reported.push(progress.kind);

            if (progress.kind === failedKind) throw error;

            return success(undefined);
          },
        },
      });

      expectLocalFailure(result, error);

      expect(reported).toEqual(
        failedKind === 'reset' ? ['reset'] : ['reset', 'snapshot'],
      );

      expect(transport.requests).toHaveLength(failedKind === 'reset' ? 0 : 1);

      if (failedKind === 'snapshot') {
        expect(transport.requests[0]!.signal.aborted).toBe(true);
        expect(transport.requests[0]!.signal.reason).toBe(error);
      }
    },
  );

  for (const observation of ['rejected', 'accepted'] as const) {
    test.each([
      ['application error', () => NetworkError.connectionFailed()],
      [
        'unexpected exception',
        () => new TypeError('Observation network failed'),
      ],
    ] as const)(
      `a thrown %s from ${observation} observation never enters provider retry`,
      async (_name, createError) => {
        const error = createError();

        const observe = spyOn(
          TranslationCapabilityState.prototype,
          observation,
        ).mockImplementation(async () => {
          throw error;
        });

        const transport = new FakeStreamingGeneration([
          observation === 'accepted'
            ? { result: valid }
            : {
                error: new APICallError({
                  message: 'response_format is unsupported',
                  statusCode: 400,
                  url: context.baseURL,
                  requestBodyValues: {},
                }),
              },
          { result: valid },
        ]);

        const result = await run(transport);

        expectLocalFailure(result, error);
        expect(observe).toHaveBeenCalledTimes(1);
        expect(transport.requests).toHaveLength(1);
      },
    );
  }

  test('local prompt construction fails before invoking the provider', async () => {
    const error = new TypeError('Language display name lookup failed');
    const language = Language.create('en-US');

    Object.defineProperty(language, 'name', {
      get() {
        throw error;
      },
    });

    const transport = new FakeStreamingGeneration([{ result: valid }]);

    const result = await executeTranslation(
      transport,
      context,
      VALID_IMAGE,
      language,
      true,
      new FakeTranslationCapabilityStorage(),
    );

    expectLocalFailure(result, error);
    expect(transport.requests).toHaveLength(0);
  });
});
