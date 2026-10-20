import { describe, expect, test } from 'bun:test';
import {
  PROVIDER_DEFAULT_CONFIGURATION,
  type ThinkingContext,
} from '../../translation/transports/ai-sdk/sdk-generation-configurations';
import { nativeThinkingConfigurations } from './native-thinking-configurations';

function configurations(provider: string, modelId: string) {
  return nativeThinkingConfigurations({ provider, modelId });
}

describe('Adapter: native thinking configurations', () => {
  test.each([
    ['google', 'gemini-2.0-flash'],
    ['google', 'future-vision'],
    ['google', 'gemini-3.3-flash'],
    ['openai', 'gpt-4o'],
    ['openai', 'gpt-5-pro'],
    ['openai', 'gpt-99-future'],
    ['openai', 'o1-mini'],
    ['openai', 'gpt-6.1-astra'],
    ['openai', 'gpt-5.5-mini'],
    ['anthropic', 'claude-3-5-sonnet-20241022'],
    ['anthropic', 'claude-sonnet-4-99'],
    ['groq', 'meta-llama/llama-4-scout-17b-16e-instruct'],
    ['xai', 'grok-4.20-0309-reasoning'],
    ['xai', 'grok-4.20-non-reasoning'],
    ['mistral', 'pixtral-large-latest'],
    ['mistral', 'magistral-small-latest'],
    ['deepseek', 'deepseek-chat'],
    ['deepseek', 'deepseek-reasoner'],
    ['deepseek', 'deepseek-pro'],
    ['deepseek', 'deepseek-v4.1-pro'],
    ['deepseek', 'deepseek-v4.99-flash'],
  ])(
    'leaves %s / %s unchanged without a verified control',
    (provider, model) => {
      expect(configurations(provider, model)).toEqual([
        PROVIDER_DEFAULT_CONFIGURATION,
      ]);
    },
  );

  test('delegates gateway providers to their own policy', () => {
    expect(configurations('nvidia', 'qwen/qwen3.5-397b-a17b')).toBeUndefined();
  });

  test.each([
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'models/gemini-2.5-flash-preview-09-2025',
  ])('disables %s with a zero token budget', (model) => {
    expect(configurations('google', model)?.[0]).toMatchObject({
      intent: 'disabled',
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    });
  });

  test('uses the documented minimum instead of invalid zero on Gemini 2.5 Pro', () => {
    expect(configurations('google', 'gemini-2.5-pro')?.[0]).toMatchObject({
      intent: 'minimum',
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 128 } } },
    });
  });

  test.each([
    'gemini-3-pro-preview',
    'gemini-3.1-pro-preview',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-4-argon',
  ])('uses low rather than unsupported minimal for %s', (model) => {
    expect(configurations('google', model)?.[0]).toMatchObject({
      intent: 'minimum',
      providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } },
    });
  });

  test.each([
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-image',
  ])(
    'uses the documented minimal level for %s without claiming zero reasoning',
    (model) => {
      expect(configurations('google', model)?.[0]).toMatchObject({
        intent: 'minimum',
        providerOptions: {
          google: { thinkingConfig: { thinkingLevel: 'minimal' } },
        },
      });
    },
  );

  test.each(['gpt-5', 'gpt-5-mini', 'gpt-5-nano-2025-08-07'])(
    'uses minimal for mandatory reasoning model %s',
    (model) => {
      expect(configurations('openai', model)?.[0]).toMatchObject({
        intent: 'minimum',
        providerOptions: { openai: { reasoningEffort: 'minimal' } },
      });
    },
  );

  test.each([
    'gpt-5.1',
    'gpt-5.2',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
    'gpt-5.5',
    'gpt-5.6',
    'gpt-5.6-sol',
    'gpt-5.6-terra',
    'gpt-5.6-luna',
  ])('tries none then low before provider defaults on %s', (model) => {
    const choices = configurations('openai', model)!;

    expect(choices.map((choice) => choice.intent)).toEqual([
      'disabled',
      'minimum',
      'provider-default',
    ]);

    expect(choices[0].providerOptions).toEqual({
      openai: { reasoningEffort: 'none' },
    });

    expect(choices[1].providerOptions).toEqual({
      openai: { reasoningEffort: 'low' },
    });
  });

  test.each(['gpt-6-sol', 'gpt-6-luna', 'gpt-6-sol-2026-09-03'])(
    'forwards verified native none when the installed SDK would omit it on %s',
    (model) => {
      const choices = configurations('openai', model)!;

      expect(choices.map((choice) => choice.intent)).toEqual([
        'disabled',
        'minimum',
        'provider-default',
      ]);

      expect(choices[0]).toMatchObject({
        requestBody: { reasoning: { effort: 'none' } },
      });

      expect(choices[0].providerOptions).toBeUndefined();

      expect(choices[1].providerOptions).toEqual({
        openai: { reasoningEffort: 'low' },
      });
    },
  );

  test.each(['gpt-6-astra', 'gpt-6.1-sol', 'o3', 'o3-mini', 'o4-mini'])(
    'does not send unsupported none for %s',
    (model) => {
      expect(configurations('openai', model)?.[0]).toMatchObject({
        intent: 'minimum',
        providerOptions: { openai: { reasoningEffort: 'low' } },
      });
    },
  );

  test.each(['gpt-5.2-pro', 'gpt-5.4-pro', 'gpt-5.5-pro'])(
    'uses medium as the native minimum of %s',
    (model) => {
      expect(configurations('openai', model)?.[0]).toMatchObject({
        intent: 'minimum',
        providerOptions: { openai: { reasoningEffort: 'medium' } },
      });
    },
  );

  test.each([
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-5',
    'claude-haiku-5-5',
    'claude-opus-4-8',
  ])('explicitly disables thinking for %s', (model) => {
    expect(configurations('anthropic', model)?.[0]).toMatchObject({
      intent: 'disabled',
      providerOptions: { anthropic: { thinking: { type: 'disabled' } } },
    });
  });

  test.each(['claude-opus-5', 'claude-haiku-5-5'])(
    'pins low effort so %s accepts disabling thinking',
    (model) => {
      expect(configurations('anthropic', model)?.[0]).toMatchObject({
        intent: 'disabled',
        providerOptions: {
          anthropic: { thinking: { type: 'disabled' }, effort: 'low' },
        },
      });
    },
  );

  test.each([
    'claude-opus-5-5',
    'claude-fable-5-1',
    'claude-mythos-5',
    'claude-mythos-preview',
  ])('minimizes mandatory thinking for %s', (model) => {
    expect(configurations('anthropic', model)?.[0]).toMatchObject({
      intent: 'minimum',
      providerOptions: {
        anthropic: { thinking: { type: 'adaptive' }, effort: 'low' },
      },
    });
  });

  test('uses native between_tools for Sonnet 5.5 without tools in this app', () => {
    expect(configurations('anthropic', 'claude-sonnet-5-5')?.[0]).toMatchObject(
      {
        intent: 'disabled',
        requestBody: { thinking: { type: 'between_tools' } },
        providerOptions: { anthropic: { effort: 'low' } },
      },
    );
  });

  test.each(['qwen/qwen3-32b', 'qwen/qwen3.6-27b', 'qwen/qwen3.8-27b'])(
    'bypasses the outdated SDK none allowlist for %s',
    (model) => {
      expect(configurations('groq', model)?.[0]).toMatchObject({
        intent: 'disabled',
        providerOptions: { groq: { reasoningEffort: 'none' } },
      });
    },
  );

  test('uses the documented low fallback only on Qwen 3.8, which supports it', () => {
    expect(configurations('groq', 'qwen/qwen3.8-27b')?.[1]).toMatchObject({
      intent: 'minimum',
      providerOptions: { groq: { reasoningEffort: 'low' } },
    });

    expect(configurations('groq', 'qwen/qwen3.6-27b')?.[1]).toEqual(
      PROVIDER_DEFAULT_CONFIGURATION,
    );
  });

  test.each([
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'meta-models/muse-spark-open',
  ])('minimizes mandatory Groq reasoning on %s', (model) => {
    expect(configurations('groq', model)?.[0]).toMatchObject({
      intent: 'minimum',
      providerOptions: { groq: { reasoningEffort: 'low' } },
    });
  });

  test('disables Grok 4.3 but keeps mandatory newer Grok reasoning at low', () => {
    expect(configurations('xai', 'grok-4.3')?.[0]).toMatchObject({
      intent: 'disabled',
      providerOptions: { xai: { reasoningEffort: 'none' } },
    });

    for (const model of ['grok-4.5', 'grok-4.6', 'grok-4.7']) {
      expect(configurations('xai', model)?.[0]).toMatchObject({
        intent: 'minimum',
        providerOptions: { xai: { reasoningEffort: 'low' } },
      });
    }
  });

  test.each([
    'mistral-small-latest',
    'mistral-medium-3-5',
    'mistral-large-4-0',
  ])(
    'preserves the documented Mistral wire control even for SDK-unknown %s',
    (model) => {
      expect(configurations('mistral', model)?.[0]).toMatchObject({
        intent: 'minimum',
        requestBody: { reasoning_effort: 'none' },
      });
    },
  );

  test('uses low on Mistral-hosted GLM 5.3, where none is unsupported', () => {
    expect(configurations('mistral', 'zai-glm-5-3')?.[0]).toMatchObject({
      intent: 'minimum',
      requestBody: { reasoning_effort: 'low' },
    });
  });

  test.each([
    'deepseek-flash',
    'deepseek-v4-pro',
    'deepseek-v4-flash',
    'deepseek-v4-flash-vision-exp',
  ])(
    'disables current DeepSeek thinking through its native toggle for %s',
    (model) => {
      expect(configurations('deepseek', model)?.[0]).toMatchObject({
        intent: 'disabled',
        providerOptions: { deepseek: { thinking: { type: 'disabled' } } },
      });
    },
  );

  test('minimizes DeepSeek thinking if its native off control is rejected', () => {
    expect(configurations('deepseek', 'deepseek-flash')?.[1]).toMatchObject({
      intent: 'minimum',
      providerOptions: {
        deepseek: { thinking: { type: 'enabled' }, reasoningEffort: 'low' },
      },
    });
  });

  test('every supported route ends with an option-free fallback and has distinct stable identities', () => {
    const cases: ThinkingContext[] = [
      { provider: 'google', modelId: 'gemini-3.8-flash' },
      { provider: 'openai', modelId: 'gpt-5.1' },
      { provider: 'anthropic', modelId: 'claude-sonnet-5-5' },
      { provider: 'groq', modelId: 'qwen/qwen3.8-27b' },
      { provider: 'xai', modelId: 'grok-4.3' },
      { provider: 'mistral', modelId: 'mistral-large-4-0' },
      { provider: 'deepseek', modelId: 'deepseek-flash' },
    ];

    for (const context of cases) {
      const choices = nativeThinkingConfigurations(context)!;

      expect(choices.at(-1)).toEqual(PROVIDER_DEFAULT_CONFIGURATION);

      expect(new Set(choices.map((choice) => choice.id)).size).toBe(
        choices.length,
      );

      expect(choices.every((choice) => choice.reasoning === undefined)).toBe(
        true,
      );
    }
  });
});
