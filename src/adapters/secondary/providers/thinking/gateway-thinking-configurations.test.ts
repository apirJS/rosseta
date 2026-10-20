import { describe, expect, test } from 'bun:test';
import { gatewayThinkingConfigurations } from './gateway-thinking-configurations';
import {
  PROVIDER_DEFAULT_CONFIGURATION,
  type ThinkingContext,
} from '../../translation/transports/ai-sdk/sdk-generation-configurations';

function configurations(provider: string, modelId: string) {
  return gatewayThinkingConfigurations({ provider, modelId });
}

describe('Gateway thinking controls', () => {
  test('keeps unfamiliar providers and custom hosts out of the gateway policy', () => {
    expect(configurations('google', 'gemini-2.5-flash')).toBeUndefined();

    expect(
      gatewayThinkingConfigurations({
        provider: 'custom-example',
        modelId: 'qwen3.5',
        baseURL: 'https://example.org/v1',
      }),
    ).toBeUndefined();

    expect(
      gatewayThinkingConfigurations({
        provider: 'custom-example',
        modelId: 'deepseek-flash',
        baseURL: 'https://api.deepseek.com.example.org',
      }),
    ).toBeUndefined();
  });

  test.each([
    'deepinfra',
    'zai',
    'nvidia',
    'huggingface',
    'puter',
    'opencode',
    'openrouter',
  ])('leaves unknown %s models unchanged', (provider) => {
    expect(configurations(provider, 'unfamiliar-reasoner')).toEqual([
      PROVIDER_DEFAULT_CONFIGURATION,
    ]);
  });

  test('DeepInfra uses the verified off and minimum effort values for Qwen', () => {
    const variants = configurations('deepinfra', 'Qwen/Qwen3.8-27B')!;

    expect(variants.map((variant) => variant.intent)).toEqual([
      'disabled',
      'minimum',
      'provider-default',
    ]);

    expect(variants[0].providerOptions).toEqual({
      deepinfra: { reasoningEffort: 'none' },
    });

    expect(variants[1].providerOptions).toEqual({
      deepinfra: { reasoningEffort: 'low' },
    });
  });

  test('DeepInfra uses its documented Chat Completions effort field instead of inferring numeric API support from a model card', () => {
    expect(
      configurations('deepinfra', 'deepseek-ai/DeepSeek-V4.1-Flash')![0],
    ).toMatchObject({
      intent: 'disabled',
      providerOptions: { deepinfra: { reasoningEffort: 'none' } },
      rejectionFields: ['reasoning_effort'],
    });
  });

  test.each(['deepinfra', 'zai'])(
    '%s never sends thinking disabled to mandatory GLM 5.3',
    (provider) => {
      const model =
        provider === 'deepinfra' ? 'zai-org/GLM-5.3-Flash' : 'glm-5.3-flash';

      const variants = configurations(provider, model)!;

      expect(variants.map((variant) => variant.intent)).toEqual([
        'minimum',
        'provider-default',
      ]);

      expect(variants[0].providerOptions).toEqual({
        [provider]: { reasoningEffort: 'low' },
      });
    },
  );

  test('Z.ai uses its native thinking field on hybrid models', () => {
    expect(configurations('zai', 'glm-4.6v')![0].providerOptions).toEqual({
      zai: { thinking: { type: 'disabled' } },
    });
  });

  test('OpenRouter requests off through reasoning, without treating exclusion as off', () => {
    expect(
      configurations('openrouter', 'qwen/qwen3.5-397b-a17b')![0]
        .providerOptions,
    ).toEqual({ openrouter: { reasoning: { effort: 'none' } } });

    expect(
      configurations('openrouter', 'openai/gpt-oss-120b')![0],
    ).toMatchObject({
      intent: 'minimum',
      providerOptions: { openrouter: { reasoning: { effort: 'low' } } },
    });
  });

  test('OpenRouter falls back from off to the verified minimum on current OpenAI models', () => {
    const variants = configurations('openrouter', 'openai/gpt-5.2')!;

    expect(variants.map((variant) => variant.intent)).toEqual([
      'disabled',
      'minimum',
      'provider-default',
    ]);

    expect(variants[1].providerOptions).toEqual({
      openrouter: { reasoning: { effort: 'low' } },
    });
  });

  test.each([
    ['google/gemini-3-pro-preview', 'low'],
    ['google/gemini-3.1-flash-lite-preview', 'minimal'],
    ['anthropic/claude-opus-5.5', 'low'],
    ['z-ai/glm-5.3-flashx', 'low'],
  ])('OpenRouter %s starts at its native minimum', (model, effort) => {
    expect(configurations('openrouter', model)![0]).toMatchObject({
      intent: 'minimum',
      providerOptions: { openrouter: { reasoning: { effort } } },
    });
  });

  test('Hugging Face supplies the explicit Responses SDK option that portable reasoning cannot forward', () => {
    expect(
      configurations('huggingface', 'openai/gpt-oss-120b:groq')![0],
    ).toMatchObject({
      intent: 'minimum',
      providerOptions: { huggingface: { reasoningEffort: 'low' } },
    });
  });

  test.each(['moonshotai/kimi-k2.5', 'moonshotai/kimi-k2.6'])(
    'NVIDIA %s uses the distinct template thinking key',
    (model) => {
      expect(configurations('nvidia', model)![0].providerOptions).toEqual({
        nvidia: { chat_template_kwargs: { thinking: false } },
      });
    },
  );

  test('NVIDIA Super 3 prefers its hosted effort API and retains low as a fallback', () => {
    const variants = configurations(
      'nvidia',
      'nvidia/nemotron-3-super-120b-a12b',
    )!;

    expect(variants[0].providerOptions).toEqual({
      nvidia: { reasoningEffort: 'none' },
    });

    expect(variants[1].providerOptions).toEqual({
      nvidia: { reasoningEffort: 'low' },
    });
  });

  test('NVIDIA Super 3.5 uses its documented template switch before minimum effort', () => {
    const variants = configurations(
      'nvidia',
      'nvidia/nemotron-3.5-super-vl-120b-a12b',
    )!;

    expect(variants[0].providerOptions).toEqual({
      nvidia: { chat_template_kwargs: { enable_thinking: false } },
    });

    expect(variants[1].providerOptions).toEqual({
      nvidia: { reasoningEffort: 'low' },
    });
  });

  test('NVIDIA Muse Glimmer uses the native minimum reasoning strength without claiming off', () => {
    expect(configurations('nvidia', 'meta/muse-glimmer-30b')![0]).toMatchObject(
      {
        intent: 'minimum',
        providerOptions: {
          nvidia: { chat_template_kwargs: { reasoning_strength: 'low' } },
        },
      },
    );
  });

  test.each([
    'qwen/qwen3.5-122b-a10b',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    'z-ai/glm4.7',
  ])('NVIDIA %s uses its verified template switch', (model) => {
    expect(configurations('nvidia', model)![0].providerOptions).toEqual({
      nvidia: { chat_template_kwargs: { enable_thinking: false } },
    });
  });

  test.each([
    'nvidia/nemotron-nano-9b-v2',
    'qwen/qwen3-vl-235b-a22b-thinking',
    'stepfun-ai/step-5-preview',
  ])('does not guess switches for NVIDIA %s', (model) => {
    expect(configurations('nvidia', model)).toEqual([
      PROVIDER_DEFAULT_CONFIGURATION,
    ]);
  });

  test.each([
    ['gemini-3-flash-preview', 'minimal'],
    ['google/gemini-3.1-flash-lite', 'minimal'],
    ['gemini-4-argon', 'low'],
    ['meta/muse-spark', 'low'],
    ['openai/gpt-5', 'minimal'],
    ['openai/gpt-5.2', 'none'],
  ])('Puter %s uses a supported effort of %s', (model, effort) => {
    expect(configurations('puter', model)![0].puterEffort).toBe(effort);
  });

  test('Puter does not send a thinking property that the installed SDK drops', () => {
    expect(configurations('puter', 'anthropic/claude-sonnet-4.5')).toEqual([
      PROVIDER_DEFAULT_CONFIGURATION,
    ]);
  });

  test.each([
    'openrouter/gpt-5.2',
    'anthropic/gpt-5.2',
    'google/gpt-5.2',
    'meta/gpt-5.2',
    'openai/gemini-4-argon',
    'o1-mini',
    'gpt-5.2-pro-unknown',
  ])(
    'Puter does not infer thinking controls from unfamiliar route %s',
    (model) => {
      expect(configurations('puter', model)).toEqual([
        PROVIDER_DEFAULT_CONFIGURATION,
      ]);
    },
  );

  test('Puter retains minimum effort after none is explicitly rejected', () => {
    expect(
      configurations('puter', 'openai/gpt-5.2')!.map(
        (variant) => variant.puterEffort,
      ),
    ).toEqual(['none', 'low', undefined]);
  });

  test('custom Anthropic routes defer to their protocol-specific policy', () => {
    expect(
      gatewayThinkingConfigurations({
        provider: 'custom-old',
        providerName: 'Saved Provider',
        protocol: 'anthropic',
        baseURL: 'https://api.z.ai/api/anthropic',
        modelId: 'glm-5.3',
      }),
    ).toBeUndefined();
  });

  test('custom provider namespaces match the installed SDK when display names contain dots', () => {
    expect(
      gatewayThinkingConfigurations({
        provider: 'custom-old',
        providerName: 'Saved.Provider',
        baseURL: 'https://api.deepseek.com/v1',
        modelId: 'deepseek-flash',
      })![0].providerOptions,
    ).toEqual({ Saved: { thinking: { type: 'disabled' } } });
  });

  test.each(['puter', 'openrouter'])(
    '%s leaves GPT-5 Pro unchanged because its only effort equals its default',
    (provider) => {
      const model =
        provider === 'openrouter' ? 'openai/gpt-5-pro' : 'gpt-5-pro';

      expect(configurations(provider, model)).toEqual([
        PROVIDER_DEFAULT_CONFIGURATION,
      ]);
    },
  );

  test.each([
    [
      'https://api.z.ai/api/paas/v4',
      'glm-4.6v',
      { thinking: { type: 'disabled' } },
    ],
    [
      'https://api.deepseek.com/v1',
      'deepseek-flash',
      { thinking: { type: 'disabled' } },
    ],
    [
      'https://integrate.api.nvidia.com/v1',
      'moonshotai/kimi-k2.5',
      { chat_template_kwargs: { thinking: false } },
    ],
    [
      'https://openrouter.ai/api/v1',
      'qwen/qwen3.5-397b-a17b',
      { reasoning: { effort: 'none' } },
    ],
  ])(
    'custom endpoint %s uses the configured SDK namespace',
    (baseURL, modelId, expected) => {
      const context: ThinkingContext = {
        provider: 'custom-old',
        providerName: 'Saved Provider',
        baseURL,
        modelId,
      };

      expect(
        gatewayThinkingConfigurations(context)![0].providerOptions,
      ).toEqual({ 'Saved Provider': expected });
    },
  );

  test('all nondefault variants end in a clean provider default with stable distinct identities', () => {
    const profiles = [
      configurations('deepinfra', 'Qwen/Qwen3.8-27B'),
      configurations('zai', 'glm-4.6v'),
      configurations('nvidia', 'nvidia/nemotron-3-super-120b-a12b'),
      configurations('openrouter', 'qwen/qwen3.5'),
      configurations('puter', 'gemini-4-argon'),
    ];

    for (const variants of profiles) {
      expect(variants!.at(-1)).toEqual(PROVIDER_DEFAULT_CONFIGURATION);

      expect(new Set(variants!.map((variant) => variant.id)).size).toBe(
        variants!.length,
      );

      expect(
        variants!.every((variant) => variant.reasoning === undefined),
      ).toBe(true);
    }
  });
});
