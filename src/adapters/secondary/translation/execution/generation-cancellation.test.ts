import { describe, expect, test } from 'bun:test';
import { APICallError } from 'ai';
import {
  FakeStreamingGeneration,
  type ScriptedGeneration,
} from '../../../../../tests/fakes/FakeStreamingGeneration';
import { FakeTranslationCapabilityStorage } from '../../../../../tests/fakes/FakeTranslationCapabilityStorage';
import {
  TARGET_LANGUAGE,
  VALID_IMAGE,
  VALID_PAIRED_TRANSLATION_RESPONSE,
} from '../../../../../tests/test-fixtures';
import { ErrorCode } from '../../../../shared/errors';
import { AbortCancellationToken } from '../../../primary/background/translation/AbortCancellationToken';
import { executeTranslation } from '../execute-translation';
import type {
  GenerationEvent,
  GenerationRequest,
  GenerationResult,
} from '../transports/GenerationTransport';

const context = {
  providerId: 'cancellation-test',
  modelId: 'vision',
  protocol: 'test',
  baseURL: 'https://fixture.invalid/v1',
};

const valid: GenerationResult = {
  text: JSON.stringify(VALID_PAIRED_TRANSLATION_RESPONSE),
  finishReason: 'stop',
  schemaValidated: false,
};

const malformed: GenerationResult = {
  text: '{"broken":',
  finishReason: 'stop',
  schemaValidated: false,
};

/** Settle natively, then cancel between the awaiting execution owners. */
class CancellingGeneration extends FakeStreamingGeneration {
  readonly configurations = [
    { id: 'off', rejectionFields: ['reasoning_effort'] },
    { id: 'default', rejectionFields: [] },
  ];

  constructor(
    scripts: ScriptedGeneration[],
    private readonly cancellation: AbortCancellationToken,
    private readonly cancelInvocation: number,
    private readonly microtasks: number,
  ) {
    super(scripts);
    this.supportedModes = ['plain-buffered'];
  }

  override generate(
    request: GenerationRequest,
    onEvent: (event: GenerationEvent) => Promise<void>,
  ): Promise<GenerationResult> {
    const native = super.generate(request, onEvent);

    if (this.requests.length === this.cancelInvocation)
      afterMicrotasks(this.microtasks, () => this.cancellation.cancel());

    return native;
  }
}

function afterMicrotasks(remaining: number, callback: () => void): void {
  queueMicrotask(() => {
    if (remaining === 1) callback();
    else afterMicrotasks(remaining - 1, callback);
  });
}

describe('Adapter: cancellation after native generation settles', () => {
  test.each([
    { phase: 'initial', completion: 'failure', microtasks: 2 },
    { phase: 'repair', completion: 'failure', microtasks: 2 },
    { phase: 'initial', completion: 'success', microtasks: 3 },
    { phase: 'repair', completion: 'success', microtasks: 4 },
  ] as const)(
    '$phase $completion does not teach compatibility after cancellation',
    async ({ phase, completion, microtasks }) => {
      const token = new AbortCancellationToken();
      const storage = new FakeTranslationCapabilityStorage();

      const rejection = new APICallError({
        message: 'reasoning_effort is unsupported',
        statusCode: 400,
        url: context.baseURL,
        requestBodyValues: {},
        responseBody: JSON.stringify({
          error: {
            message: 'reasoning_effort is unsupported',
            param: 'reasoning_effort',
          },
        }),
      });

      const terminal =
        completion === 'success' ? { result: valid } : { error: rejection };

      const scripts =
        phase === 'repair' ? [{ result: malformed }, terminal] : [terminal];

      const expectedInvocations = phase === 'repair' ? 2 : 1;

      const transport = new CancellingGeneration(
        scripts,
        token,
        expectedInvocations,
        microtasks,
      );

      const result = await executeTranslation(
        transport,
        context,
        VALID_IMAGE,
        TARGET_LANGUAGE,
        true,
        storage,
        { cancellationToken: token },
      );

      // Logical cancellation can return before already-settled native work's
      // continuations finish. Drain that work before checking durable facts.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.code).toBe(ErrorCode.TRANSLATION_CANCELLED);
      expect(transport.requests).toHaveLength(expectedInvocations);

      expect(transport.requests.every(({ signal }) => signal.aborted)).toBe(
        true,
      );

      const facts = [...storage.records.values()].flatMap((record) =>
        Object.values(record.facts),
      );

      expect(facts.length).toBeGreaterThan(0);

      expect(
        facts.filter(
          ({ source }) =>
            source === 'observed-completion' || source === 'explicit-provider',
        ),
      ).toEqual([]);
    },
  );
});
