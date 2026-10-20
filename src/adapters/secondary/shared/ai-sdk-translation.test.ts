function noop(): void {}
import { z } from 'zod';
import { createTranslationDataSchema } from './translation-schema';
import { describe, expect, spyOn, test } from 'bun:test';
import { APICallError } from 'ai';
import { executeTranslation } from './ai-sdk-translation';
import { FakeStreamingGeneration } from '../../../../tests/fakes/FakeStreamingGeneration';
import { FakeTranslationCapabilityStorage } from '../../../../tests/fakes/FakeTranslationCapabilityStorage';
import { VALID_IMAGE, TARGET_LANGUAGE } from '../../../../tests/test-fixtures';
import { success, failure } from '../../../shared/types/Result';
import type {
  TranslationProgress,
  TranslationExecutionOptions,
} from '../../../core/ports/outbound/TranslationExecutionOptions';
import type { GenerationResult } from './ITranslationGenerationTransport';
import { modelScopeKey, capabilityDigest } from './translation-capability-key';
import { ErrorCode, NetworkError } from '../../../shared/errors';
import { AbortCancellationToken } from '../../primary/background/services/AbortCancellationToken';
import { UNAVAILABLE_RESPONSE_FORMAT_ERROR } from '../../../../tests/fixtures/captured-provider-errors';

export const PAIRED_RESPONSE = {
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
const context = {
  providerId: 'test',
  modelId: 'vision',
  protocol: 'test',
  baseURL: 'https://test.invalid/v1',
};
const valid: GenerationResult = {
  text: JSON.stringify(PAIRED_RESPONSE),
  output: PAIRED_RESPONSE,
  finishReason: 'stop',
  schemaValidated: true,
};
const plain: GenerationResult = {
  text: valid.text,
  finishReason: 'stop',
  schemaValidated: false,
};
const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_TEST_START = Date.UTC(2026, 9, 20);

function api(message: string, statusCode = 400) {
  return new APICallError({
    message,
    statusCode,
    url: context.baseURL,
    requestBodyValues: {},
  });
}

function run(
  transport: FakeStreamingGeneration,
  storage = new FakeTranslationCapabilityStorage(),
  options: TranslationExecutionOptions = {},
) {
  return executeTranslation(
    transport,
    context,
    VALID_IMAGE,
    TARGET_LANGUAGE,
    true,
    storage,
    options,
  );
}

async function exclude(
  storage: FakeTranslationCapabilityStorage,
  modes: string[],
) {
  const identity = await modelScopeKey(context);
  const schema = await capabilityDigest(
    z.toJSONSchema(createTranslationDataSchema(true), {
      target: 'draft-07',
      io: 'input',
    }),
  );
  const facts = Object.fromEntries(
    modes.map((mode) => [
      mode === 'image'
        ? 'feature.image'
        : mode.startsWith('structured')
          ? `mode.${mode}:${schema}`
          : `mode.${mode}`,
      {
        support: 'unsupported' as const,
        source: 'explicit-provider',
        observedAt: Date.now(),
        scope: 'model',
      },
    ]),
  );
  await storage.merge(identity, 0, facts);
}

describe('Adapter: shared streaming execution', () => {
  test('publishes unfinished strings before final validation and returns canonical domain data', async () => {
    const progress: TranslationProgress[] = [];
    const transport = new FakeStreamingGeneration([
      {
        events: [
          {
            type: 'partial',
            value: {
              success: true,
              data: {
                segments: [{ originalText: 'sou', translatedText: 'He' }],
              },
            },
          },
        ],
        result: valid,
      },
    ]);
    const result = await run(transport, undefined, {
      progress: {
        report: async (event) => {
          progress.push(event);
          return success(undefined);
        },
      },
    });
    expect(result.success).toBe(true);
    expect(progress[0].kind).toBe('reset');
    expect(
      progress.some(
        (event) =>
          event.kind === 'snapshot' &&
          event.draft.segments[0].translatedText === 'He',
      ),
    ).toBe(true);
    if (result.success) expect(result.data.translated[0].text).toBe('Hello');
  });

  test('waits for reset acknowledgement before provider invocation', async () => {
    let release: () => void = noop;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const transport = new FakeStreamingGeneration([{ result: valid }]);
    const pending = run(transport, undefined, {
      progress: {
        report: async () => {
          await barrier;
          return success(undefined);
        },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(transport.requests.length).toBe(0);
    release();
    expect((await pending).success).toBe(true);
  });

  test('learns explicit structured rejection and directly selects known working fallback on a repeated request', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new FakeStreamingGeneration([
      { error: api('This model does not support response format json_schema') },
      { result: plain },
      { result: plain },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect((await run(transport, storage)).success).toBe(true);
    expect(transport.requests.map((r) => r.mode)).toEqual([
      'structured-stream',
      'plain-stream',
      'plain-stream',
    ]);
  });

  test('captured unavailable response_format falls back once and directly uses plain streaming afterward', async () => {
    const storage = new FakeTranslationCapabilityStorage();

    const error = new APICallError({
      message: 'Request rejected',
      statusCode: 400,
      url: context.baseURL,
      requestBodyValues: {},
      responseBody: JSON.stringify(UNAVAILABLE_RESPONSE_FORMAT_ERROR),
    });

    const transport = new FakeStreamingGeneration([
      { error },
      { result: plain },
      { result: plain },
    ]);

    expect((await run(transport, storage)).success).toBe(true);
    expect((await run(transport, storage)).success).toBe(true);
    expect(transport.requests.map((request) => request.mode)).toEqual([
      'structured-stream',
      'plain-stream',
      'plain-stream',
    ]);

    expect(
      storage.records.get(await modelScopeKey(context))?.facts[
        'feature.structured'
      ].support,
    ).toBe('unsupported');
  });

  test('six-day fallback reuse does not postpone the exact seven-day compatibility refresh', async () => {
    const clock = spyOn(Date, 'now').mockReturnValue(REFRESH_TEST_START);
    try {
      const storage = new FakeTranslationCapabilityStorage();
      const transport = new FakeStreamingGeneration([
        { error: api('This response_format type is unavailable now') },
        { result: plain },
        { result: plain },
        { result: valid },
        { result: valid },
      ]);
      const identity = await modelScopeKey(context);

      expect((await run(transport, storage)).success).toBe(true);
      expect(storage.records.get(identity)?.refreshedAt).toBe(
        REFRESH_TEST_START,
      );

      clock.mockReturnValue(REFRESH_TEST_START + 6 * DAY_MS);

      expect((await run(transport, storage)).success).toBe(true);
      expect(storage.records.get(identity)?.refreshedAt).toBe(
        REFRESH_TEST_START,
      );
      expect(transport.requests.map((request) => request.mode)).toEqual([
        'structured-stream',
        'plain-stream',
        'plain-stream',
      ]);

      const refreshedAt = REFRESH_TEST_START + 7 * DAY_MS;
      clock.mockReturnValue(refreshedAt);
      expect((await run(transport, storage)).success).toBe(true);
      expect((await run(transport, storage)).success).toBe(true);
      expect(transport.requests.map((request) => request.mode)).toEqual([
        'structured-stream',
        'plain-stream',
        'plain-stream',
        'structured-stream',
        'structured-stream',
      ]);

      expect(storage.records.get(identity)?.refreshedAt).toBe(refreshedAt);
      expect(
        storage.records.get(identity)?.facts['feature.structured'].support,
      ).toBe('supported');
    } finally {
      clock.mockRestore();
    }
  });

  test('an unsupported mode discovered again at seven days falls back once and remains cached', async () => {
    const clock = spyOn(Date, 'now').mockReturnValue(REFRESH_TEST_START);
    try {
      const storage = new FakeTranslationCapabilityStorage();
      const transport = new FakeStreamingGeneration([
        { error: api('This response_format type is unavailable now') },
        { result: plain },
        { error: api('This response_format type is unavailable now') },
        { result: plain },
        { result: plain },
      ]);

      expect((await run(transport, storage)).success).toBe(true);
      const refreshedAt = REFRESH_TEST_START + 7 * DAY_MS;
      clock.mockReturnValue(refreshedAt);

      expect((await run(transport, storage)).success).toBe(true);
      clock.mockReturnValue(refreshedAt + 1);

      expect((await run(transport, storage)).success).toBe(true);
      expect(transport.requests.map((request) => request.mode)).toEqual([
        'structured-stream',
        'plain-stream',
        'structured-stream',
        'plain-stream',
        'plain-stream',
      ]);

      const record = storage.records.get(await modelScopeKey(context));
      expect(record?.refreshedAt).toBe(refreshedAt);
      expect(record?.facts['feature.structured'].support).toBe('unsupported');
    } finally {
      clock.mockRestore();
    }
  });

  test('provider namespace refresh clears positive fallback selection and preserves other providers', async () => {
    const clock = spyOn(Date, 'now').mockReturnValue(REFRESH_TEST_START);
    try {
      const storage = new FakeTranslationCapabilityStorage();
      const provider = new FakeStreamingGeneration([
        { error: api('response_format is not supported') },
        { result: plain },
        { result: valid },
      ]);
      const otherContext = { ...context, providerId: 'another-provider' };
      const other = new FakeStreamingGeneration([
        { error: api('response_format is not supported') },
        { result: plain },
        { result: plain },
      ]);
      const runOther = () =>
        executeTranslation(
          other,
          otherContext,
          VALID_IMAGE,
          TARGET_LANGUAGE,
          true,
          storage,
        );

      expect((await run(provider, storage)).success).toBe(true);
      expect((await runOther()).success).toBe(true);
      const otherIdentity = await modelScopeKey(otherContext);
      const otherGeneration = storage.records.get(otherIdentity)?.generation;

      expect((await storage.resetNamespace(context.providerId)).success).toBe(
        true,
      );
      expect((await run(provider, storage)).success).toBe(true);
      expect((await runOther()).success).toBe(true);
      expect(provider.requests.map((request) => request.mode)).toEqual([
        'structured-stream',
        'plain-stream',
        'structured-stream',
      ]);

      expect(other.requests.map((request) => request.mode)).toEqual([
        'structured-stream',
        'plain-stream',
        'plain-stream',
      ]);
      expect(storage.records.get(otherIdentity)?.generation).toBe(
        otherGeneration,
      );
      expect(
        storage.records.get(otherIdentity)?.facts['feature.structured'].support,
      ).toBe('unsupported');
    } finally {
      clock.mockRestore();
    }
  });

  test('falls back to structured buffered when streaming generally unsupported', async () => {
    const transport = new FakeStreamingGeneration([
      { error: api('Streaming is not supported for this model') },
      { result: valid },
    ]);
    expect((await run(transport)).success).toBe(true);
    expect(transport.requests.map((r) => r.mode)).toEqual([
      'structured-stream',
      'structured-buffered',
    ]);
  });

  test('combination rejection retains plain streaming', async () => {
    const transport = new FakeStreamingGeneration([
      { error: api('Structured streaming is not supported') },
      { result: plain },
    ]);
    expect((await run(transport)).success).toBe(true);
    expect(transport.requests[1].mode).toBe('plain-stream');
  });

  test('stops before a fourth repair call and reuses learned compatibility on the next translation', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new FakeStreamingGeneration([
      { error: api('response format json_schema not supported') },
      { error: api('streaming not supported') },
      {
        result: {
          text: 'bad JSON',
          finishReason: 'stop',
          schemaValidated: false,
        },
      },
      { result: plain },
    ]);
    expect((await run(transport, storage)).success).toBe(false);
    expect(transport.requests.map((request) => request.mode)).toEqual([
      'structured-stream',
      'plain-stream',
      'plain-buffered',
    ]);
    expect(transport.scripts).toHaveLength(1);

    expect((await run(transport, storage)).success).toBe(true);
    expect(transport.requests).toHaveLength(4);
    expect(transport.requests[3].mode).toBe('plain-buffered');
    expect(transport.requests[3].userText).not.toContain(
      'untrusted_previous_response',
    );
    expect(transport.requests[3].image).toBe(VALID_IMAGE);
  });

  test('does not promote interrupted text to success, allows one buffered restart', async () => {
    const transport = new FakeStreamingGeneration([
      {
        events: [{ type: 'text', text: valid.text }],
        error: new TypeError('network disconnected'),
      },
      { result: valid },
    ]);
    expect((await run(transport)).success).toBe(true);
    expect(transport.requests.map((r) => r.mode)).toEqual([
      'structured-stream',
      'structured-buffered',
    ]);
  });
  test('persistent no-vision stops repeated requests locally', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new FakeStreamingGeneration([
      { error: api('This model does not support images') },
    ]);
    expect((await run(transport, storage)).success).toBe(false);
    expect((await run(transport, storage)).success).toBe(false);
    expect(transport.requests.length).toBe(1);
  });
  test('uses eligible structured buffered repair if plain buffered already unsupported', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    await exclude(storage, ['plain-buffered']);
    const transport = new FakeStreamingGeneration([
      { result: { text: 'bad', schemaValidated: false, finishReason: 'stop' } },
      { result: valid },
    ]);
    expect((await run(transport, storage)).success).toBe(true);
    expect(transport.requests[1].mode).toBe('structured-buffered');
  });
  test('cannot repair through a known unsupported buffered mode', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    await exclude(storage, ['plain-buffered', 'structured-buffered']);
    const transport = new FakeStreamingGeneration([
      { result: { text: 'bad', schemaValidated: false, finishReason: 'stop' } },
    ]);
    const result = await run(transport, storage);
    expect(result.success).toBe(false);
    expect(transport.requests.length).toBe(1);
  });
  test('repair is not recursive', async () => {
    const transport = new FakeStreamingGeneration([
      { result: { text: 'bad', schemaValidated: false, finishReason: 'stop' } },
      {
        result: {
          text: 'still bad',
          schemaValidated: false,
          finishReason: 'stop',
        },
      },
    ]);
    expect((await run(transport)).success).toBe(false);
    expect(transport.requests.length).toBe(2);
  });
  test('empty output does not discover other modes', async () => {
    const transport = new FakeStreamingGeneration([
      { result: { text: '', schemaValidated: false, finishReason: 'stop' } },
    ]);
    const result = await run(transport);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_EMPTY_RESPONSE);
    expect(transport.requests.length).toBe(1);
  });
  test('no-text final rejection still learns the accepted generation mode', async () => {
    const storage = new FakeTranslationCapabilityStorage();
    const transport = new FakeStreamingGeneration([
      {
        result: {
          text: '{"success":false,"error":"NO_TEXT_FOUND","data":null}',
          finishReason: 'stop',
          schemaValidated: true,
        },
      },
    ]);
    const result = await run(transport, storage);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_NO_TEXT_FOUND);
    const record = await storage.read(await modelScopeKey(context));
    expect(
      record.success && record.data?.facts['feature.structured'].support,
    ).toBe('supported');
  });
  test('deadline returns while a provider remains pending and prevents fallback', async () => {
    let enter: () => void = noop;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const token = new AbortCancellationToken();
    const timers = spyOn(globalThis, 'setTimeout');
    try {
      const transport = new FakeStreamingGeneration([
        {
          events: [{ type: 'partial', value: PAIRED_RESPONSE }],
          wait: new Promise(() => {}),
          result: valid,
        },
      ]);
      const pending = run(transport, undefined, {
        cancellationToken: token,
        progress: {
          report: async (event) => {
            if (event.kind === 'snapshot') enter();
            return success(undefined);
          },
        },
      });
      await entered;
      expect(transport.requests).toHaveLength(1);
      const expiry = timers.mock.calls.find(
        (call) => typeof call[1] === 'number' && call[1] >= 59000,
      )?.[0];
      expect(typeof expiry).toBe('function');
      if (typeof expiry !== 'function')
        throw new Error('Generation deadline timer was not registered');
      expiry();
      const result = await pending;
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
      expect(transport.requests).toHaveLength(1);
    } finally {
      token.cancel();
      timers.mockRestore();
    }
  });
  test('cancel before start does not invoke transport', async () => {
    const token = new AbortCancellationToken();
    token.cancel();
    const transport = new FakeStreamingGeneration([]);
    const result = await run(transport, undefined, {
      cancellationToken: token,
    });
    expect(result.success).toBe(false);
    expect(transport.requests.length).toBe(0);
  });
  test.each([401, 402, 403, 404, 429, 413])(
    'terminal HTTP %i never discovers capabilities',
    async (status) => {
      const transport = new FakeStreamingGeneration([
        { error: api('request rejected', status) },
      ]);
      expect((await run(transport)).success).toBe(false);
      expect(transport.requests.length).toBe(1);
    },
  );
  test('oversized stream is bounded without repair', async () => {
    const transport = new FakeStreamingGeneration([
      { events: [{ type: 'text', text: 'x'.repeat(1048577) }], result: valid },
    ]);
    const result = await run(transport);
    expect(result.success).toBe(false);
    expect(transport.requests.length).toBe(1);
  });
  test('empty envelope prefixes do not delay the first useful preview', async () => {
    const progress: TranslationProgress[] = [];
    const transport = new FakeStreamingGeneration([
      {
        events: [
          { type: 'partial', value: { data: { segments: [] } } },
          {
            type: 'partial',
            value: { data: { segments: [{ originalText: 'Visible' }] } },
          },
        ],
        result: valid,
      },
    ]);
    expect(
      (
        await run(transport, undefined, {
          progress: {
            report: async (event) => {
              progress.push(event);
              return success(undefined);
            },
          },
        })
      ).success,
    ).toBe(true);
    expect(progress.filter((event) => event.kind === 'snapshot')).toEqual([
      {
        kind: 'snapshot',
        draft: {
          segments: [
            {
              index: 0,
              blockIndex: null,
              originalText: 'Visible',
              translatedText: '',
              sourceLanguageCode: null,
              romanization: null,
            },
          ],
          description: null,
        },
      },
    ]);
  });
  test('display delivery failure aborts the logical job without a provider restart', async () => {
    const error = NetworkError.connectionFailed();
    const transport = new FakeStreamingGeneration([
      { events: [{ type: 'partial', value: PAIRED_RESPONSE }], result: valid },
    ]);
    const result = await run(transport, undefined, {
      progress: {
        report: async (event) =>
          event.kind === 'reset' ? success(undefined) : failure(error),
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe(error);
    expect(transport.requests).toHaveLength(1);
  });
  test('oversized buffered structured objects fail directly without repair', async () => {
    const output = structuredClone(PAIRED_RESPONSE);
    output.data.segments[0].originalText = 'x'.repeat(1048577);
    const transport = new FakeStreamingGeneration([
      {
        result: {
          output,
          text: '',
          finishReason: 'stop',
          schemaValidated: true,
        },
      },
    ]);
    const result = await run(transport);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_RESPONSE_LIMIT);
    expect(transport.requests).toHaveLength(1);
  });
  test('UTF-16 surrogate pairs across empty deltas count as one UTF-8 code point', async () => {
    const transport = new FakeStreamingGeneration([
      {
        events: [
          { type: 'text', text: 'x'.repeat(1048572) },
          { type: 'text', text: '\ud83d' },
          { type: 'text', text: '' },
          { type: 'text', text: '\ude00' },
        ],
        result: valid,
      },
    ]);
    expect((await run(transport)).success).toBe(true);
  });
});
