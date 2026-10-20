import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { APICallError, StreamProviderError } from 'ai';
import {
  FakeStreamingGeneration,
  type ScriptedGeneration,
} from '../../../../tests/fakes/FakeStreamingGeneration';
import { FakeTranslationCapabilityStorage } from '../../../../tests/fakes/FakeTranslationCapabilityStorage';
import { VALID_IMAGE, TARGET_LANGUAGE } from '../../../../tests/test-fixtures';
import { AbortCancellationToken } from '../../primary/background/services/AbortCancellationToken';
import type { TranslationExecutionOptions } from '../../../core/ports/outbound/TranslationExecutionOptions';
import { ErrorCode, StorageError } from '../../../shared/errors';
import { failure } from '../../../shared/types/Result';
import { executeTranslation } from './ai-sdk-translation';
import type { GenerationConfiguration } from './generation-configurations';
import type {
  GenerationEvent,
  GenerationRequest,
  GenerationResult,
} from './ITranslationGenerationTransport';
import { modelScopeKey } from './translation-capability-key';

const OFF = 'thinking.fixture-off.v1';
const MINIMUM = 'thinking.fixture-minimum.v1';
const OMIT = 'thinking.fixture-default.v1';
const DEFAULT_CONFIGURATIONS: readonly GenerationConfiguration[] = [
  { id: OFF, rejectionFields: ['reasoning_effort'] },
  { id: MINIMUM, rejectionFields: ['reasoning_effort'] },
  { id: OMIT, rejectionFields: [] },
];
const context = {
  providerId: 'configuration-fixture',
  modelId: 'vision',
  protocol: 'fixture',
  baseURL: 'https://configuration.invalid/v1',
};
const response = {
  success: true,
  error: null,
  data: {
    segments: [
      {
        blockIndex: 0,
        originalText: 'source',
        translatedText: 'Hello',
        originalLanguageBcp47Code: 'ja-JP',
        romanization: null,
      },
    ],
    description: 'Greeting',
  },
};
const valid: GenerationResult = {
  text: JSON.stringify(response),
  output: response,
  finishReason: 'stop',
  schemaValidated: true,
};
const plain: GenerationResult = {
  text: valid.text,
  finishReason: 'stop',
  schemaValidated: false,
};
const malformed: GenerationResult = {
  text: '{bad JSON',
  finishReason: 'stop',
  schemaValidated: false,
};
const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 20);

class ConfiguredGeneration extends FakeStreamingGeneration {
  onRequest?: (request: GenerationRequest) => void;

  constructor(
    scripts: ScriptedGeneration[],
    readonly configurations: readonly GenerationConfiguration[] = DEFAULT_CONFIGURATIONS,
  ) {
    super(scripts);
  }

  override generate(
    request: GenerationRequest,
    onEvent: (event: GenerationEvent) => Promise<void>,
  ): Promise<GenerationResult> {
    this.onRequest?.(request);
    return super.generate(request, onEvent);
  }
}

class UnavailableCapabilityWrites extends FakeTranslationCapabilityStorage {
  writesUnavailable = true;

  override async merge(
    ...args: Parameters<FakeTranslationCapabilityStorage['merge']>
  ) {
    return this.writesUnavailable
      ? failure(StorageError.writeFailed('fixture'))
      : super.merge(...args);
  }
}

function noop(): void {}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = noop;
  const promise = new Promise<void>((release) => {
    resolve = release;
  });
  return { promise, resolve };
}

function api(message: string, statusCode = 400, param?: string): APICallError {
  return new APICallError({
    message: 'Request rejected',
    statusCode,
    url: context.baseURL,
    requestBodyValues: {},
    responseBody: JSON.stringify({ error: { message, param } }),
  });
}

const rejectedThinking = () =>
  api(
    "Unsupported value: 'none' is not supported with this model",
    400,
    'reasoning_effort',
  );
const profileIds = (transport: ConfiguredGeneration) =>
  transport.requests.map((request) => request.configurationId);
const run = (
  transport: ConfiguredGeneration,
  storage = new FakeTranslationCapabilityStorage(),
  options: TranslationExecutionOptions = {},
) =>
  executeTranslation(
    transport,
    context,
    VALID_IMAGE,
    TARGET_LANGUAGE,
    true,
    storage,
    options,
  );
const facts = async (storage: FakeTranslationCapabilityStorage) =>
  storage.records.get(await modelScopeKey(context))!.facts;

describe('Adapter: translation configuration compatibility fallback', () => {
  afterEach(() => mock.restore());

  test('retries the current mode with minimum thinking and directly reuses the accepted profile', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new ConfiguredGeneration([
      { error: rejectedThinking() },
      { result: valid },
      { result: valid },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect((await run(transport, storage)).success).toBe(true);
    expect(profileIds(transport)).toEqual([OFF, MINIMUM, MINIMUM]);
    expect(transport.requests.map((request) => request.mode)).toEqual([
      'structured-stream',
      'structured-stream',
      'structured-stream',
    ]);
    const stored = await facts(storage);
    expect(stored[`configuration.${OFF}`].support).toBe('unsupported');
    expect(stored[`configuration.${MINIMUM}`].support).toBe('supported');
    expect(stored['feature.structured'].support).toBe('supported');
    expect(stored['feature.stream'].support).toBe('supported');
  });

  test('falls back to provider defaults after rejecting both disabled and minimum thinking', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new ConfiguredGeneration([
      { error: rejectedThinking() },
      { error: api('Invalid value for reasoning_effort', 422) },
      { result: valid },
      { result: valid },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect((await run(transport, storage)).success).toBe(true);
    expect(profileIds(transport)).toEqual([OFF, MINIMUM, OMIT, OMIT]);
    const stored = await facts(storage);
    expect(stored[`configuration.${OFF}`].support).toBe('unsupported');
    expect(stored[`configuration.${MINIMUM}`].support).toBe('unsupported');
    expect(stored[`configuration.${OMIT}`].support).toBe('supported');
  });

  test('falls back and caches an explicit in-band provider rejection after streaming starts', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new ConfiguredGeneration([
      {
        error: new StreamProviderError({
          statusCode: 200,
          code: 'invalid_request_error',
          message: 'reasoning_effort is unsupported',
        }),
      },
      { result: valid },
      { result: valid },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect((await run(transport, storage)).success).toBe(true);
    expect(profileIds(transport)).toEqual([OFF, MINIMUM, MINIMUM]);
    expect((await facts(storage))[`configuration.${OFF}`].support).toBe(
      'unsupported',
    );
  });

  test('learns schema and thinking limitations independently without losing the selected mode', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new ConfiguredGeneration([
      { error: api('response_format json_schema is not supported') },
      { error: rejectedThinking() },
      { result: plain },
      { result: plain },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect((await run(transport, storage)).success).toBe(true);
    expect(
      transport.requests.map((request) => [
        request.mode,
        request.configurationId,
      ]),
    ).toEqual([
      ['structured-stream', OFF],
      ['plain-stream', OFF],
      ['plain-stream', MINIMUM],
      ['plain-stream', MINIMUM],
    ]);
    const stored = await facts(storage);
    expect(stored['feature.structured'].support).toBe('unsupported');
    expect(stored['feature.stream'].support).toBe('supported');
    expect(stored[`configuration.${OFF}`].support).toBe('unsupported');
    expect(stored[`configuration.${MINIMUM}`].support).toBe('supported');
  });

  test('uses model-wide configuration facts when the description schema changes', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const withoutDescription = {
      ...response,
      data: { segments: response.data.segments },
    };
    const transport = new ConfiguredGeneration([
      { error: rejectedThinking() },
      { result: valid },
      {
        result: {
          text: JSON.stringify(withoutDescription),
          output: withoutDescription,
          finishReason: 'stop',
          schemaValidated: true,
        },
      },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect(
      (
        await executeTranslation(
          transport,
          context,
          VALID_IMAGE,
          TARGET_LANGUAGE,
          false,
          storage,
        )
      ).success,
    ).toBe(true);
    expect(profileIds(transport)).toEqual([OFF, MINIMUM, MINIMUM]);
  });

  test('keeps configuration learning isolated by model and endpoint', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new ConfiguredGeneration([
      { error: rejectedThinking() },
      { result: valid },
      { result: valid },
      { result: valid },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    const anotherModel = { ...context, modelId: 'another-vision' };
    const anotherEndpoint = {
      ...context,
      baseURL: 'https://another-configuration.invalid/v1',
    };
    expect(
      (
        await executeTranslation(
          transport,
          anotherModel,
          VALID_IMAGE,
          TARGET_LANGUAGE,
          true,
          storage,
        )
      ).success,
    ).toBe(true);
    expect(
      (
        await executeTranslation(
          transport,
          anotherEndpoint,
          VALID_IMAGE,
          TARGET_LANGUAGE,
          true,
          storage,
        )
      ).success,
    ).toBe(true);
    expect(profileIds(transport)).toEqual([OFF, MINIMUM, OFF, OFF]);
    expect(storage.records).toHaveLength(3);
  });

  test('a validated no-text response still establishes the accepted thinking profile', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const noText = { success: false, error: 'NO_TEXT_FOUND', data: null };
    const transport = new ConfiguredGeneration([
      { error: rejectedThinking() },
      {
        result: {
          text: JSON.stringify(noText),
          output: noText,
          finishReason: 'stop',
          schemaValidated: true,
        },
      },
      { result: valid },
    ]);
    const result = await run(transport, storage);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_NO_TEXT_FOUND);
    expect((await run(transport, storage)).success).toBe(true);
    expect(profileIds(transport)).toEqual([OFF, MINIMUM, MINIMUM]);
  });

  test('retains the exact repair prompt while retrying a rejected thinking profile', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new ConfiguredGeneration([
      { result: malformed },
      { error: rejectedThinking() },
      { result: plain },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect(
      transport.requests.map((request) => [
        request.mode,
        request.configurationId,
      ]),
    ).toEqual([
      ['structured-stream', OFF],
      ['plain-buffered', OFF],
      ['plain-buffered', MINIMUM],
    ]);
    expect(transport.requests[1].userText).toContain(
      'untrusted_previous_response',
    );
    expect(transport.requests[2].userText).toBe(transport.requests[1].userText);
    expect(transport.requests[2].image).toBe(VALID_IMAGE);
  });

  test('completes combined thinking, schema, streaming, and repair fallback in six calls', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new ConfiguredGeneration([
      { error: rejectedThinking() },
      { error: api('Invalid value for reasoning_effort', 422) },
      { error: api('response_format is unsupported') },
      { error: api('streaming is unsupported') },
      { result: malformed },
      { result: plain },
      { result: plain },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect(transport.requests.map(request => request.mode)).toEqual([
      'structured-stream', 'structured-stream', 'structured-stream',
      'plain-stream', 'plain-buffered', 'plain-buffered',
    ]);
    expect(profileIds(transport)).toEqual([OFF, MINIMUM, OMIT, OMIT, OMIT, OMIT]);
    expect(transport.requests[4].userText).not.toContain('untrusted_previous_response');
    expect(transport.requests[5].userText).toContain('untrusted_previous_response');
    expect(transport.requests[5].image).toBe(VALID_IMAGE);
    const stored = await facts(storage);
    expect(stored[`configuration.${OFF}`].support).toBe('unsupported');
    expect(stored[`configuration.${MINIMUM}`].support).toBe('unsupported');
    expect(stored[`configuration.${OMIT}`].support).toBe('supported');
    expect(stored['feature.structured'].support).toBe('unsupported');
    expect(stored['feature.stream'].support).toBe('unsupported');

    // A later translation goes directly to the working configuration and mode.
    expect((await run(transport, storage)).success).toBe(true);
    expect(transport.requests).toHaveLength(7);
    expect(transport.requests[6].mode).toBe('plain-buffered');
    expect(transport.requests[6].configurationId).toBe(OMIT);
    expect(transport.requests[6].userText).not.toContain('untrusted_previous_response');
  });

  test('stops at six shared calls and retains the final rejection for the next translation', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new ConfiguredGeneration([
      { error: api('response_format is unsupported') },
      { error: api('streaming is unsupported') },
      { error: new TypeError('network disconnected') },
      { result: malformed },
      { error: rejectedThinking() },
      { error: api('Invalid value for reasoning_effort', 422) },
      { result: plain },
    ]);
    expect((await run(transport, storage)).success).toBe(false);
    expect(transport.requests).toHaveLength(6);
    expect(transport.scripts).toHaveLength(1);
    expect(transport.requests.map(request => request.mode)).toEqual([
      'structured-stream', 'plain-stream', 'plain-buffered',
      'plain-buffered', 'plain-buffered', 'plain-buffered',
    ]);
    expect(profileIds(transport)).toEqual([OFF, OFF, OFF, OFF, OFF, MINIMUM]);
    expect(transport.requests[3].userText).not.toContain('untrusted_previous_response');
    expect(transport.requests[4].userText).toContain('untrusted_previous_response');
    expect(transport.requests[5].userText).toBe(transport.requests[4].userText);
    const stored = await facts(storage);
    expect(stored[`configuration.${OFF}`].support).toBe('unsupported');
    expect(stored[`configuration.${MINIMUM}`].support).toBe('unsupported');
    expect(stored['feature.structured'].support).toBe('unsupported');
    expect(stored['feature.stream'].support).toBe('unsupported');

    // A later real translation skips the failed settings/modes without probing.
    expect((await run(transport, storage)).success).toBe(true);
    expect(transport.requests).toHaveLength(7);
    expect(transport.scripts).toHaveLength(0);
    expect(transport.requests[6].mode).toBe('plain-buffered');
    expect(transport.requests[6].configurationId).toBe(OMIT);
  });

  test('cancellation before start prevents configuration discovery requests', async () => {
    const token = new AbortCancellationToken();
    token.cancel();
    const transport = new ConfiguredGeneration([]);
    expect(
      (await run(transport, undefined, { cancellationToken: token })).success,
    ).toBe(false);
    expect(transport.requests).toHaveLength(0);
  });

  test('cancellation at a rejected attempt prevents fallback and compatibility learning', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const token = new AbortCancellationToken();
    const transport = new ConfiguredGeneration([
      { error: rejectedThinking() },
      { result: valid },
    ]);
    transport.onRequest = () => token.cancel();
    expect(
      (await run(transport, storage, { cancellationToken: token })).success,
    ).toBe(false);
    expect(profileIds(transport)).toEqual([OFF]);
    expect((await facts(storage))[`configuration.${OFF}`].support).toBe(
      'unknown',
    );
  });

  test('deadline expiry stops a pending configuration attempt without fallback or learning', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const entered = deferred();
    const release = deferred();
    const timers = spyOn(globalThis, 'setTimeout');
    const transport = new ConfiguredGeneration([
      { wait: release.promise, error: rejectedThinking() },
      { result: valid },
    ]);
    transport.onRequest = () => entered.resolve();
    const pending = run(transport, storage);
    await entered.promise;
    const expiry = timers.mock.calls.find(
      (call) => typeof call[1] === 'number' && call[1] >= 59000,
    )?.[0];
    if (typeof expiry !== 'function')
      throw new Error('Translation deadline was not registered');
    expiry();
    const result = await pending;
    release.resolve();
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    expect(profileIds(transport)).toEqual([OFF]);
    expect((await facts(storage))[`configuration.${OFF}`].support).toBe(
      'unknown',
    );
  });

  test('clears positive and negative profiles at exactly seven days without sliding the window', async () => {
    const clock = spyOn(Date, 'now').mockReturnValue(START);
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new ConfiguredGeneration([
      { error: rejectedThinking() },
      { result: valid },
      { result: valid },
      { result: valid },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    clock.mockReturnValue(START + 6 * DAY);
    expect((await run(transport, storage)).success).toBe(true);
    expect(storage.records.get(await modelScopeKey(context))?.refreshedAt).toBe(
      START,
    );
    clock.mockReturnValue(START + 7 * DAY);
    expect((await run(transport, storage)).success).toBe(true);
    expect(profileIds(transport)).toEqual([OFF, MINIMUM, MINIMUM, OFF]);
    const stored = await facts(storage);
    expect(stored[`configuration.${OFF}`].support).toBe('supported');
    expect(stored[`configuration.${MINIMUM}`].support).toBe('unknown');
  });

  test('provider namespace refresh used by Fetch Models forgets accepted and rejected profiles', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new ConfiguredGeneration([
      { error: rejectedThinking() },
      { result: valid },
      { result: valid },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect((await storage.resetNamespace(context.providerId)).success).toBe(
      true,
    );
    expect((await run(transport, storage)).success).toBe(true);
    expect(profileIds(transport)).toEqual([OFF, MINIMUM, OFF]);
    expect((await facts(storage))[`configuration.${MINIMUM}`].support).toBe(
      'unknown',
    );
  });

  test.each(['model', 'namespace', 'expiry'] as const)(
    'stale in-flight configuration learning cannot overwrite a %s refresh',
    async (refresh) => {
      const clock = spyOn(Date, 'now').mockReturnValue(START);
      const storage = new FakeTranslationCapabilityStorage();
      const entered = deferred();
      const release = deferred();
      const transport = new ConfiguredGeneration([
        { wait: release.promise, error: rejectedThinking() },
        { result: valid },
        { result: valid },
      ]);
      transport.onRequest = () => entered.resolve();
      const old = run(transport, storage);
      await entered.promise;
      if (refresh === 'model')
        await storage.reset(await modelScopeKey(context));
      if (refresh === 'namespace')
        await storage.resetNamespace(context.providerId);
      if (refresh === 'expiry') clock.mockReturnValue(START + 7 * DAY);
      expect((await run(transport, storage)).success).toBe(true);
      release.resolve();
      expect((await old).success).toBe(true);
      expect(profileIds(transport)).toEqual([OFF, OFF, MINIMUM]);
      const stored = await facts(storage);
      expect(stored[`configuration.${OFF}`].support).toBe('supported');
      expect(stored[`configuration.${MINIMUM}`].support).toBe('unknown');
    },
  );

  test('failed writes retain both rejected and accepted profiles for reuse and later persistence', async () => {
    const storage = new UnavailableCapabilityWrites();
    const transport = new ConfiguredGeneration([
      { error: rejectedThinking() },
      { result: valid },
      { result: valid },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect((await facts(storage))[`configuration.${OFF}`]).toBeUndefined();
    storage.writesUnavailable = false;
    storage.failWith(StorageError.readFailed('fixture'));
    expect((await run(transport, storage)).success).toBe(true);
    expect(profileIds(transport)).toEqual([OFF, MINIMUM, MINIMUM]);
    const stored = await facts(storage);
    expect(stored[`configuration.${OFF}`].support).toBe('unsupported');
    expect(stored[`configuration.${MINIMUM}`].support).toBe('supported');
  });

  test.each([
    api('reasoning_effort is unsupported', 401),
    api('reasoning_effort is unsupported', 402),
    api('reasoning_effort is unsupported', 403),
    api('reasoning_effort is unsupported', 404),
    api('reasoning_effort is unsupported', 429),
    api('reasoning_effort is unsupported for your account'),
    api(
      'Invalid JSON schema: additionalProperties is required; reasoning_effort is unsupported',
    ),
    api('Invalid image payload; reasoning_effort is unsupported'),
    api('reasoning_effort is unsupported', 400, 'temperature'),
  ])(
    'terminal rejection cannot poison configuration facts %#',
    async (error) => {
      const storage = new FakeTranslationCapabilityStorage();
      const transport = new ConfiguredGeneration([
        { error },
        { result: valid },
      ]);
      expect((await run(transport, storage)).success).toBe(false);
      expect(profileIds(transport)).toEqual([OFF]);
      const stored = await facts(storage);
      for (const configuration of DEFAULT_CONFIGURATIONS)
        expect(stored[`configuration.${configuration.id}`].support).toBe(
          'unknown',
        );
    },
  );

  test('temporary provider failure only retries transport and never marks thinking unsupported', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const error = api(
      'reasoning_effort is temporarily unavailable; try again',
      503,
    );
    const transport = new ConfiguredGeneration([{ error }, { error }]);
    expect((await run(transport, storage)).success).toBe(false);
    expect(profileIds(transport)).toEqual([OFF, OFF]);
    expect((await facts(storage))[`configuration.${OFF}`].support).toBe(
      'unknown',
    );
  });

  test('conditional streaming conflict changes mode while retaining the thinking profile', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new ConfiguredGeneration([
      { error: api('reasoning_effort none is not supported in streaming') },
      { result: valid },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect(
      transport.requests.map((request) => [
        request.mode,
        request.configurationId,
      ]),
    ).toEqual([
      ['structured-stream', OFF],
      ['structured-buffered', OFF],
    ]);
    const stored = await facts(storage);
    expect(stored['feature.stream'].support).toBe('unsupported');
    expect(stored[`configuration.${OFF}`].support).toBe('supported');
  });
});
