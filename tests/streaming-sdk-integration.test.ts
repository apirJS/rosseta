import { describe, expect, test, vi } from 'vitest';
import {
  streamText,
  Output,
  NoObjectGeneratedError,
  simulateReadableStream,
} from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { AiSdkGenerationTransport } from '../src/adapters/secondary/shared/AiSdkGenerationTransport';
import { EncodedImage } from '../src/core/domain/image/EncodedImage';
import { createTranslationDataSchema } from '../src/adapters/secondary/shared/translation-schema';
import { createTranslationFixture } from './fixtures/translation-provider-server';
import { OpenAICompatibleTranslationAdapter } from '../src/adapters/secondary/openai-compatible/OpenAICompatibleTranslationAdapter';
import { AnthropicCompatibleTranslationAdapter } from '../src/adapters/secondary/anthropic-compatible/AnthropicCompatibleTranslationAdapter';
import { DeepSeekTranslationAdapter } from '../src/adapters/secondary/deepseek/DeepSeekTranslationAdapter';
import { NvidiaTranslationAdapter } from '../src/adapters/secondary/nvidia/NvidiaTranslationAdapter';
import { ApiKey } from '../src/core/domain/credential/ApiKey';
import { Credential } from '../src/core/domain/credential/Credential';
import { UserPreferences } from '../src/core/domain/preferences/UserPreferences';
import { CustomProviderConfig } from '../src/core/domain/provider/CustomProviderConfig';
import { Language } from '../src/core/domain/translation/Language';
import { FakeTranslationCapabilityStorage } from './fakes/FakeTranslationCapabilityStorage';
import { success } from '../src/shared/types/Result';
import type { TranslationProgress } from '../src/core/ports/outbound/TranslationExecutionOptions';
import type { ITranslationService } from '../src/core/ports/outbound/ITranslationService';
import type { AnyProvider } from '../src/core/domain/credential/Provider';
import { createTranslationAdapter } from '../src/adapters/secondary/TranslationAdapterFactory';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const finish: LanguageModelV4StreamPart = {
  type: 'finish',
  finishReason: { unified: 'stop', raw: 'stop' },
  usage,
};

function modelFor(chunks: LanguageModelV4StreamPart[]) {
  return new MockLanguageModelV4({
    doStream: {
      stream: simulateReadableStream({
        chunks,
        initialDelayInMs: 0,
        chunkDelayInMs: 1,
      }),
    },
  });
}

describe('Installed AI SDK streaming integration (no Bun preload)', () => {
  test('emits an unfinished string before the schema validated output settles', async () => {
    const model = modelFor([
      { type: 'text-start', id: 't' },
      { type: 'text-delta', id: 't', delta: '{"value":"Hel' },
      { type: 'text-delta', id: 't', delta: 'lo"}' },
      { type: 'text-end', id: 't' },
      finish,
    ]);
    const result = streamText({
      model,
      output: Output.object({ schema: z.object({ value: z.string() }) }),
      prompt: 'test',
      maxRetries: 0,
    });
    let finished = false;
    const final = Promise.resolve(result.output).then((value) => {
      finished = true;
      return value;
    });
    const values: unknown[] = [];
    for await (const partial of result.partialOutputStream) {
      values.push(partial);
      if ((partial as { value?: string }).value === 'Hel')
        expect(finished).toBe(false);
    }
    expect(await final).toEqual({ value: 'Hello' });
    expect(values).toContainEqual({ value: 'Hel' });
    expect(model.doStreamCalls.length).toBe(1);
  });

  test('partial loop exhaustion does not validate the final object', async () => {
    const result = streamText({
      model: modelFor([
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: '{"other":"value"}' },
        { type: 'text-end', id: 't' },
        finish,
      ]),
      output: Output.object({ schema: z.object({ value: z.string() }) }),
      prompt: 'test',
      maxRetries: 0,
    });
    const final = Promise.resolve(result.output).then(
      () => null,
      (error) => error,
    );
    for await (const partial of result.partialOutputStream) {
      void partial;
    }
    expect(NoObjectGeneratedError.isInstance(await final)).toBe(true);
  });

  test('in-band errors are visible through result.stream and onError', async () => {
    const observed: unknown[] = [];
    const source = new Error('provider interrupted');
    const result = streamText({
      model: modelFor([
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: '{"value":"Hel' },
        { type: 'error', error: source },
      ]),
      prompt: 'test',
      maxRetries: 0,
      onError: ({ error }) => {
        observed.push(error);
      },
    });
    const parts = [];
    for await (const part of result.stream) parts.push(part.type);
    expect(parts).toContain('error');
    expect(observed).toContain(source);
  });

  test('production transport returns actual schema errors with raw text for bounded manual recovery', async () => {
    const image = EncodedImage.create('data:image/png;base64,AQ==');
    if (!image.success) throw image.error;
    const transport = new AiSdkGenerationTransport(
      modelFor([
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: '{"unexpected":true}' },
        { type: 'text-end', id: 't' },
        finish,
      ]),
    );
    const result = await transport.generate(
      {
        mode: 'structured-stream',
        image: image.data,
        instructions: 'Return JSON',
        userText: 'test',
        schema: createTranslationDataSchema(),
        signal: new AbortController().signal,
      },
      async () => {},
    );
    expect(result.schemaValidated).toBe(false);
    expect(result.text).toBe('{"unexpected":true}');
    expect(NoObjectGeneratedError.isInstance(result.validationError)).toBe(
      true,
    );
  });
  test('production transport rejects in-band interruption even after receiving balanced JSON', async () => {
    const image = EncodedImage.create('data:image/png;base64,AQ==');
    if (!image.success) throw image.error;
    const transport = new AiSdkGenerationTransport(
      modelFor([
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: '{"value":"Hello"}' },
        { type: 'error', error: new TypeError('network interrupted') },
      ]),
    );
    await expect(
      transport.generate(
        {
          mode: 'plain-stream',
          image: image.data,
          instructions: 'test',
          userText: 'test',
          schema: z.object({ value: z.string() }),
          signal: new AbortController().signal,
        },
        async () => {},
      ),
    ).rejects.toThrow('network interrupted');
  });
});

describe('Production custom adapters against deterministic provider HTTP streams', () => {
  const protocols = ['openai', 'anthropic'] as const;
  const scenarios = [
    'success',
    'no-structured',
    'unavailable-response-format',
    'no-stream',
    'buffered-only',
    'combined-only',
    'malformed-repair',
    'in-band-error',
    'interruption',
  ] as const;
  test.each(
    protocols.flatMap((protocol) =>
      scenarios.map((scenario) => ({ protocol, scenario })),
    ),
  )(
    '$protocol/$scenario completes through real SDKs and reuses durable fallback',
    async ({ protocol, scenario }) => {
      const fixture = createTranslationFixture({ delayMs: 1 });
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (input, init) =>
          fixture.fetch(new Request(input, init)),
        );
      try {
        const config = CustomProviderConfig.create({
          id: 'custom-sdk-fixture',
          name: 'SDK fixture',
          type: protocol === 'anthropic' ? 'anthropic' : 'openai-compatible',
          baseURL: `http://fixture.invalid/${protocol}/${scenario}/v1`,
          headers: { 'X-Fixture-Route': 'test' },
          queryParams: { 'fixture-route': 'test' },
        });

        const key = ApiKey.createWithProvider(
          'fixture-key',
          'custom-sdk-fixture',
        );

        const image = EncodedImage.create('data:image/png;base64,AQ==');
        if (!config.success || !key.success || !image.success)
          throw new Error('Invalid fixture setup');

        const credential = Credential.create(
          crypto.randomUUID(),
          key.data,
          'custom-sdk-fixture',
        );

        if (!credential.success) throw credential.error;
        const preferences = UserPreferences.createDefault(
          crypto.randomUUID(),
        ).withSelectedModel('custom-sdk-fixture', 'fixture-vision');

        const storage = new FakeTranslationCapabilityStorage();
        const Adapter =
          protocol === 'anthropic'
            ? AnthropicCompatibleTranslationAdapter
            : OpenAICompatibleTranslationAdapter;
        const adapter = new Adapter(
          credential.data,
          preferences,
          config.data,
          storage,
        );
        const progress: TranslationProgress[] = [];
        const result = await adapter.translateImage(
          image.data,
          Language.create('en-US'),
          {
            progress: {
              report: async (event) => {
                progress.push(event);
                return success(undefined);
              },
            },
          },
        );

        expect(result.success, result.success ? '' : result.error.message).toBe(
          true,
        );

        if (result.success)
          expect(result.data.translated[0].text).toBe('Hello');
        expect(
          fixture.requests.every(
            (request) =>
              request.routingHeaderPresent && request.routingQueryPresent,
          ),
        ).toBe(true);

        if (
          scenario === 'success' ||
          scenario === 'no-structured' ||
          scenario === 'combined-only'
        )
          expect(
            progress.some(
              (event) =>
                event.kind === 'snapshot' &&
                event.draft.segments.some((row) => row.originalText.length > 0),
            ),
          ).toBe(true);

        if (scenario === 'buffered-only')
          expect(
            fixture.requests.map((request) => [
              request.streamed,
              request.structured,
            ]),
          ).toEqual([
            [true, true],
            [true, false],
            [false, false],
          ]);

        if (scenario === 'unavailable-response-format')
          expect(
            fixture.requests.map((request) => [
              request.streamed,
              request.structured,
            ]),
          ).toEqual([
            [true, true],
            [true, false],
          ]);

        if (scenario === 'malformed-repair')
          expect(fixture.requests.map((request) => request.repair)).toEqual([
            false,
            true,
          ]);

        if (scenario !== 'malformed-repair') {
          const previousCalls = fixture.requests.length;
          const repeated = await adapter.translateImage(
            image.data,
            Language.create('en-US'),
          );
          expect(repeated.success).toBe(true);
          expect(fixture.requests.length - previousCalls).toBe(1);
          expect(fixture.requests.at(-1)?.streamed).toBe(
            fixture.requests[previousCalls - 1].streamed,
          );
          expect(fixture.requests.at(-1)?.structured).toBe(
            fixture.requests[previousCalls - 1].structured,
          );
        }
      } finally {
        fetchSpy.mockRestore();
      }
    },
  );
});

describe('Native DeepSeek and NVIDIA provider HTTP contracts', () => {
  const cases = [
    { provider: 'deepseek', scenario: 'success', model: 'deepseek-flash' },
    { provider: 'deepseek', scenario: 'no-stream', model: 'deepseek-flash' },
    {
      provider: 'nvidia',
      scenario: 'success',
      model: 'meta/llama-3.2-11b-vision-instruct',
    },
    {
      provider: 'nvidia',
      scenario: 'unavailable-response-format',
      model: 'meta/llama-3.2-11b-vision-instruct',
    },
  ] as const;

  test.each(cases)(
    '$provider/$scenario preserves vision input and reuses its working mode',
    async ({ provider, scenario, model }) => {
      const fixture = createTranslationFixture({ delayMs: 1 });
      const outgoing: {
        url: string;
        authorization: string | null;
        body: {
          model: string;
          response_format?: { type: string };
          thinking?: { type: string };
          reasoning_effort?: string;
          messages: { role: string; content: unknown }[];
        };
      }[] = [];

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (input, init) => {
          const request = new Request(input, init);
          outgoing.push({
            url: request.url,
            authorization: request.headers.get('authorization'),
            body: await request.clone().json(),
          });
          const target = `http://fixture.invalid/openai/${scenario}/v1/chat/completions`;
          return fixture.fetch(new Request(target, request));
        });

      try {
        const key = ApiKey.createWithProvider('fixture-key', provider);
        const image = EncodedImage.create('data:image/png;base64,AQ==');

        if (!key.success || !image.success)
          throw new Error('Invalid provider fixture setup');

        const credential = Credential.create(
          crypto.randomUUID(),
          key.data,
          provider,
        );

        if (!credential.success) throw credential.error;

        const preferences = UserPreferences.createDefault(
          crypto.randomUUID(),
        ).withSelectedModel(provider, model);

        const storage = new FakeTranslationCapabilityStorage();
        const adapter: ITranslationService =
          provider === 'deepseek'
            ? new DeepSeekTranslationAdapter(
                credential.data,
                preferences,
                storage,
              )
            : new NvidiaTranslationAdapter(
                credential.data,
                preferences,
                storage,
              );

        expect(
          (await adapter.translateImage(image.data, Language.create('en-US')))
            .success,
        ).toBe(true);

        const expectedModes =
          scenario === 'no-stream'
            ? [
                [true, false],
                [false, false],
              ]
            : scenario === 'unavailable-response-format'
              ? [
                  [true, true],
                  [true, false],
                ]
              : [[true, provider === 'nvidia']];

        expect(
          fixture.requests.map((request) => [
            request.streamed,
            request.structured,
          ]),
        ).toEqual(expectedModes);

        const previousCalls = outgoing.length;

        expect(
          (await adapter.translateImage(image.data, Language.create('en-US')))
            .success,
        ).toBe(true);
        expect(outgoing.length - previousCalls).toBe(1);

        const expectedURL =
          provider === 'deepseek'
            ? 'https://api.deepseek.com/chat/completions'
            : 'https://integrate.api.nvidia.com/v1/chat/completions';

        for (const request of outgoing) {
          expect(request.url).toBe(expectedURL);
          expect(request.authorization).toBe('Bearer fixture-key');
          expect(request.body.model).toBe(model);

          const user = request.body.messages.find(
            (message) => message.role === 'user',
          );

          expect(user?.content).toContainEqual(
            expect.objectContaining({
              type: 'image_url',
              image_url: expect.objectContaining({ url: image.data.value }),
            }),
          );

          if (provider === 'deepseek') {
            expect(request.body.response_format).toBeUndefined();
            expect(request.body.thinking).toEqual({ type: 'disabled' });
          } else {
            expect(request.body.reasoning_effort).toBeUndefined();
          }
        }
        const record = [...storage.records.values()][0];
        expect(record.namespace).toBe(provider);

        if (provider === 'deepseek')
          expect(record.facts['feature.structured'].support).toBe('unknown');
      } finally {
        fetchSpy.mockRestore();
      }
    },
  );
});

describe('Production adapters serialize verified thinking controls', () => {
  interface Case {
    provider: AnyProvider;
    model: string;
    expected: Record<string, unknown>;
    absent?: string[];
    baseURL?: string;
    type?: 'anthropic';
  }
  const cases: Case[] = [
    {
      provider: 'google',
      model: 'gemini-2.5-flash',
      expected: { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } },
    },
    {
      provider: 'google',
      model: 'gemini-2.5-pro',
      expected: {
        generationConfig: { thinkingConfig: { thinkingBudget: 128 } },
      },
    },
    {
      provider: 'google',
      model: 'gemini-3-pro-preview',
      expected: {
        generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
      },
    },
    {
      provider: 'google',
      model: 'gemini-3-flash-preview',
      expected: {
        generationConfig: { thinkingConfig: { thinkingLevel: 'minimal' } },
      },
    },
    {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      expected: { thinking: { type: 'disabled' } },
    },
    {
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      expected: {
        thinking: { type: 'between_tools' },
        output_config: { effort: 'low' },
      },
    },
    {
      provider: 'openai',
      model: 'gpt-5',
      expected: { reasoning: { effort: 'minimal' } },
    },
    {
      provider: 'openai',
      model: 'gpt-5.2',
      expected: { reasoning: { effort: 'none' } },
    },
    {
      provider: 'openai',
      model: 'gpt-6-sol',
      expected: { reasoning: { effort: 'none' } },
    },
    {
      provider: 'openai',
      model: 'gpt-6-astra',
      expected: { reasoning: { effort: 'low' } },
    },
    {
      provider: 'groq',
      model: 'qwen/qwen3.8-27b',
      expected: { reasoning_effort: 'none' },
    },
    {
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      expected: { reasoning_effort: 'low' },
    },
    {
      provider: 'xai',
      model: 'grok-4.3',
      expected: { reasoning: { effort: 'none' } },
    },
    {
      provider: 'mistral',
      model: 'mistral-large-4-0',
      expected: { reasoning_effort: 'none' },
    },
    {
      provider: 'mistral',
      model: 'zai-glm-5-3',
      expected: { reasoning_effort: 'low' },
    },
    {
      provider: 'deepinfra',
      model: 'qwen/qwen3.8-27b',
      expected: { reasoning_effort: 'none' },
    },
    {
      provider: 'huggingface',
      model: 'openai/gpt-oss-120b',
      expected: { reasoning: { effort: 'low' } },
    },
    {
      provider: 'zai',
      model: 'glm-4.6v',
      expected: { thinking: { type: 'disabled' } },
    },
    {
      provider: 'zai',
      model: 'glm-5.3',
      expected: { reasoning_effort: 'low' },
    },
    {
      provider: 'openrouter',
      model: 'qwen/qwen3.5-397b-a17b',
      expected: { reasoning: { effort: 'none' } },
    },
    {
      provider: 'openrouter',
      model: 'openai/gpt-oss-120b',
      expected: { reasoning: { effort: 'low' } },
    },
    {
      provider: 'nvidia',
      model: 'qwen/qwen3.5-122b-a10b',
      expected: { chat_template_kwargs: { enable_thinking: false } },
    },
    {
      provider: 'nvidia',
      model: 'nvidia/nemotron-3-nano-30b-a3b',
      expected: { chat_template_kwargs: { enable_thinking: false } },
    },
    {
      provider: 'nvidia',
      model: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
      expected: { chat_template_kwargs: { enable_thinking: false } },
    },
    {
      provider: 'nvidia',
      model: 'moonshotai/kimi-k2.5',
      expected: { chat_template_kwargs: { thinking: false } },
    },
    {
      provider: 'custom-legacy-deepseek',
      model: 'deepseek-flash',
      baseURL: 'https://api.deepseek.com/v1',
      expected: { thinking: { type: 'disabled' } },
    },
    {
      provider: 'custom-legacy-nvidia',
      model: 'moonshotai/kimi-k2.5',
      baseURL: 'https://integrate.api.nvidia.com/v1',
      expected: { chat_template_kwargs: { thinking: false } },
    },
    {
      provider: 'custom-legacy-anthropic',
      model: 'claude-sonnet-4-5',
      baseURL: 'https://fixture.invalid/v1',
      type: 'anthropic',
      expected: { thinking: { type: 'disabled' } },
    },
    {
      provider: 'custom-legacy-anthropic',
      model: 'claude-sonnet-5-5',
      baseURL: 'https://fixture.invalid/v1',
      type: 'anthropic',
      expected: {
        thinking: { type: 'between_tools' },
        output_config: { effort: 'low' },
      },
    },
    {
      provider: 'custom-unknown',
      model: 'qwen/qwen3.8-27b',
      baseURL: 'https://fixture.invalid/v1',
      expected: {},
      absent: [
        'reasoning',
        'reasoning_effort',
        'thinking',
        'chat_template_kwargs',
      ],
    },
    {
      provider: 'nvidia',
      model: 'nvidia/nemotron-nano-9b-v2',
      expected: {},
      absent: ['reasoning_effort', 'thinking', 'chat_template_kwargs'],
    },
    {
      provider: 'opencode',
      model: 'fixture-vision',
      expected: {},
      absent: ['reasoning', 'reasoning_effort', 'thinking'],
    },
  ];

  test.each(cases)(
    '$provider/$model sends only the verified provider settings',
    async ({ provider, model, baseURL, type, expected, absent }) => {
      const bodies: unknown[] = [];
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (input, init) => {
          bodies.push(await new Request(input, init).json());
          // Capture the real SDK's HTTP body, without using live credentials or accounts.
          return new Response(
            JSON.stringify({
              error: {
                message: 'Fixture authentication failure',
                type: 'authentication_error',
                code: 401,
              },
            }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          );
        });

      try {
        const key = ApiKey.createWithProvider('fixture-key', provider);
        const image = EncodedImage.create('data:image/png;base64,AQ==');
        if (!key.success || !image.success)
          throw new Error('Invalid test setup');

        const credential = Credential.create(
          crypto.randomUUID(),
          key.data,
          provider,
        );

        if (!credential.success) throw credential.error;
        const config = baseURL
          ? CustomProviderConfig.create({
              id: provider,
              name: 'Legacy Provider',
              baseURL,
              type,
            })
          : undefined;

        if (config && !config.success) throw config.error;
        const adapter = createTranslationAdapter(
          credential.data,
          UserPreferences.createDefault(crypto.randomUUID()).withSelectedModel(
            provider,
            model,
          ),
          config?.data,
          new FakeTranslationCapabilityStorage(),
        );

        expect(
          (await adapter.translateImage(image.data, Language.create('en-US')))
            .success,
        ).toBe(false);
        expect(bodies).toHaveLength(1);
        expect(bodies[0]).toMatchObject(expected);

        for (const field of absent ?? [])
          expect(bodies[0]).not.toHaveProperty(field);
      } finally {
        fetchSpy.mockRestore();
      }
    },
  );
});
