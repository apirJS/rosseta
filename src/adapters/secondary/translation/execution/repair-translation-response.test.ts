import { afterEach, describe, expect, test } from 'bun:test';
import { APICallError } from 'ai';
import { FakeStreamingGeneration } from '../../../../../tests/fakes/FakeStreamingGeneration';
import { FakeTranslationCapabilityStorage } from '../../../../../tests/fakes/FakeTranslationCapabilityStorage';
import {
  TARGET_LANGUAGE,
  VALID_IMAGE,
  VALID_PAIRED_TRANSLATION_RESPONSE,
} from '../../../../../tests/test-fixtures';
import { ErrorCode, NetworkError } from '../../../../shared/errors';
import { TranslationCapabilityState } from '../compatibility/TranslationCapabilityState';
import { buildRepairPrompt } from '../output/prompt-base';
import { createGenerationResponseSchema } from '../output/translation-schema';
import type {
  AttemptReceipt,
  GenerationConfiguration,
  GenerationResult,
} from '../transports/GenerationTransport';
import { GenerationBudget } from './generation-budget';
import { GenerationSelection } from './generation-selection';
import {
  executionScope,
  type TranslationExecutionScope,
} from './translation-execution';
import {
  generateWithFallback,
  type GenerationExecution,
} from './generate-with-fallback';
import { repairTranslationResponse } from './repair-translation-response';

const scopes: TranslationExecutionScope[] = [];

const malformed: GenerationResult = {
  text: '{"broken":',
  finishReason: 'stop',
  schemaValidated: false,
};

const valid: GenerationResult = {
  text: JSON.stringify(VALID_PAIRED_TRANSLATION_RESPONSE),
  finishReason: 'stop',
  schemaValidated: false,
};

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.dispose();
});

async function executionFor(
  transport: FakeStreamingGeneration,
  configurations: GenerationConfiguration[] = [],
): Promise<GenerationExecution> {
  const state = new TranslationCapabilityState(
    'repair-test',
    'repair-schema',
    new FakeTranslationCapabilityStorage(),
  );

  await state.load();

  const scope = executionScope();

  scopes.push(scope);

  return {
    transport,
    state,
    scope,
    image: VALID_IMAGE,
    targetLanguage: TARGET_LANGUAGE,
    includeDescription: true,
    schema: createGenerationResponseSchema(),
    budget: new GenerationBudget(),
    selection: new GenerationSelection(
      configurations,
      (id) => state.configurationSupport(id),
      (mode, id) => state.support(mode, id),
    ),
  };
}

async function initialAttempt(
  execution: GenerationExecution,
): Promise<AttemptReceipt> {
  const generated = await generateWithFallback(execution, { kind: 'initial' });

  expect(generated.kind).toBe('generated');
  if (generated.kind !== 'generated')
    throw new Error('Expected initial generation');

  return generated.receipt;
}

describe('Adapter: explicit response repair', () => {
  test('keeps the image, previous text, shared signal and successful route through control fallback', async () => {
    const rejected = new APICallError({
      message: 'reasoning_effort is unsupported',
      statusCode: 400,
      url: 'https://fixture.invalid',
      requestBodyValues: {},
      responseBody: JSON.stringify({
        error: {
          message: 'reasoning_effort is unsupported',
          param: 'reasoning_effort',
        },
      }),
    });

    const transport = new FakeStreamingGeneration([
      { result: malformed },
      { error: rejected },
      { result: valid },
    ]);

    transport.supportedModes = ['plain-buffered'];

    const configurations = [
      { id: 'off', rejectionFields: ['reasoning_effort'] },
      { id: 'default', rejectionFields: [] },
    ];

    const execution = await executionFor(transport, configurations);
    const previousAttempt = await initialAttempt(execution);

    const repaired = await repairTranslationResponse(execution, {
      previousAttempt,
      previousResponse: malformed.text,
    });

    expect(repaired.success).toBe(true);

    expect(
      transport.requests.map(({ mode, configurationId }) => [
        mode,
        configurationId,
      ]),
    ).toEqual([
      ['plain-buffered', 'off'],
      ['plain-buffered', 'off'],
      ['plain-buffered', 'default'],
    ]);

    for (const request of transport.requests.slice(1)) {
      expect(request.image).toBe(transport.requests[0].image);
      expect(request.signal).toBe(execution.scope.signal);
      expect(request.userText).toBe(buildRepairPrompt(malformed.text));
    }

    if (!repaired.success) return;

    expect(repaired.data.receipt.route).toEqual({
      mode: 'plain-buffered',
      configurationId: 'default',
    });

    execution.selection.afterConfigurationRejection('plain-buffered');
    expect(repaired.data.receipt.route.configurationId).toBe('default');
    expect(previousAttempt.route.configurationId).toBe('off');
    expect(execution.scope.signal.aborted).toBe(false);
  });

  test.each(['no-buffered-route', 'budget-exhausted'] as const)(
    '%s returns malformed-response without a repair invocation',
    async (reason) => {
      const transport = new FakeStreamingGeneration([
        { result: malformed },
        { result: valid },
      ]);

      transport.supportedModes =
        reason === 'no-buffered-route'
          ? ['plain-stream']
          : ['plain-stream', 'plain-buffered'];

      const execution = await executionFor(transport);
      const previousAttempt = await initialAttempt(execution);

      if (reason === 'budget-exhausted')
        while (execution.budget.hasCapacity)
          execution.budget.recordInvocation();

      const result = await repairTranslationResponse(execution, {
        previousAttempt,
        previousResponse: malformed.text,
      });

      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.code).toBe(
          ErrorCode.TRANSLATION_MALFORMED_RESPONSE,
        );
      expect(transport.requests).toHaveLength(1);
    },
  );

  test('a restart consumed by initial generation cannot be recreated for repair', async () => {
    const error = NetworkError.connectionFailed();

    const transport = new FakeStreamingGeneration([
      { error },
      { result: malformed },
      { error },
      { result: valid },
    ]);

    const execution = await executionFor(transport);
    const previousAttempt = await initialAttempt(execution);

    expect(execution.budget.canRestart).toBe(false);

    const result = await repairTranslationResponse(execution, {
      previousAttempt,
      previousResponse: malformed.text,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe(error);
    expect(transport.requests).toHaveLength(3);
    expect(transport.requests[2].mode.endsWith('buffered')).toBe(true);
  });

  test('a second unusable completion ends repair without recursively generating again', async () => {
    const transport = new FakeStreamingGeneration([
      { result: malformed },
      { result: malformed },
      { result: valid },
    ]);

    const execution = await executionFor(transport);
    const previousAttempt = await initialAttempt(execution);

    const result = await repairTranslationResponse(execution, {
      previousAttempt,
      previousResponse: malformed.text,
    });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_MALFORMED_RESPONSE);
    expect(transport.requests).toHaveLength(2);

    expect(transport.requests[1].userText).toBe(
      buildRepairPrompt(malformed.text),
    );
  });
});
