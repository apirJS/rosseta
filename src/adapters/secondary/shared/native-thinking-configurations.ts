import {
  PROVIDER_DEFAULT_CONFIGURATION,
  type ThinkingConfiguration,
  type ThinkingContext,
} from './generation-configurations';

/** Only documented model families receive native controls; unknown routes keep their defaults. */
export function nativeThinkingConfigurations(
  context: ThinkingContext,
): readonly ThinkingConfiguration[] | undefined {
  const model = context.modelId.toLowerCase().replace(/^models\//, '');
  switch (context.provider) {
    case 'google':
      return googleConfigurations(model);
    case 'openai':
      return openaiConfigurations(model);
    case 'anthropic':
      return anthropicConfigurations(model);
    case 'groq':
      return groqConfigurations(model);
    case 'xai':
      return xaiConfigurations(model);
    case 'mistral':
      return mistralConfigurations(model);
    case 'deepseek':
      return deepseekConfigurations(model);
    default:
      return undefined;
  }
}

function withDefault(
  ...configurations: ThinkingConfiguration[]
): readonly ThinkingConfiguration[] {
  return [...configurations, PROVIDER_DEFAULT_CONFIGURATION];
}

function googleConfigurations(model: string): readonly ThinkingConfiguration[] {
  if (/^gemini-2\.5-pro(?:-|$)/.test(model)) {
    return withDefault(googleBudget(128, 'minimum'));
  }
  if (/^gemini-2\.5-flash(?:-|$)/.test(model)) {
    return withDefault(googleBudget(0, 'disabled'));
  }
  if (/^gemini-3(?:\.1)?-pro(?:-|$)/.test(model) && !model.includes('-image')) {
    return withDefault(googleLevel('low'));
  }
  if (
    /^gemini-3\.[78]-flash(?:-|$)/.test(model) ||
    /^gemini-4-argon(?:-|$)/.test(model)
  ) {
    return withDefault(googleLevel('low'));
  }
  if (
    /^gemini-3(?:\.[56])?-flash(?:-|$)/.test(model) ||
    /^gemini-3\.1-flash-lite(?:-|$)/.test(model)
  ) {
    return withDefault(googleLevel('minimal'));
  }
  return withDefault();
}

function googleBudget(
  budget: number,
  intent: 'disabled' | 'minimum',
): ThinkingConfiguration {
  return {
    id: `thinking.google.budget-${budget}.v1`,
    intent,
    rejectionFields: ['thinkingConfig', 'thinkingBudget', 'thinking_budget'],
    providerOptions: { google: { thinkingConfig: { thinkingBudget: budget } } },
  };
}

function googleLevel(level: 'minimal' | 'low'): ThinkingConfiguration {
  return {
    id: `thinking.google.level-${level}.v1`,
    intent: 'minimum',
    rejectionFields: ['thinkingConfig', 'thinkingLevel', 'thinking_level'],
    providerOptions: { google: { thinkingConfig: { thinkingLevel: level } } },
  };
}

function openaiConfigurations(model: string): readonly ThinkingConfiguration[] {
  const name = model.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  if (/^gpt-5\.[245]-pro$/.test(name)) {
    return withDefault(openaiEffort('medium', 'minimum'));
  }
  if (/^gpt-5(?:-(?:mini|nano))?$/.test(name)) {
    return withDefault(openaiEffort('minimal', 'minimum'));
  }
  if (
    /^gpt-5\.[1245]$/.test(name) ||
    /^gpt-5\.4-(?:mini|nano)$/.test(name) ||
    /^gpt-5\.6(?:-(?:sol|terra|luna))?$/.test(name)
  ) {
    return withDefault(
      openaiEffort('none', 'disabled'),
      openaiEffort('low', 'minimum'),
    );
  }
  if (/^gpt-6-(?:sol|luna)$/.test(name)) {
    return withDefault(
      {
        ...openaiEffort('none', 'disabled'),
        // The installed SDK incorrectly excludes none from all GPT-6 models.
        providerOptions: undefined,
        requestBody: { reasoning: { effort: 'none' } },
      },
      openaiEffort('low', 'minimum'),
    );
  }
  if (
    name === 'gpt-6-astra' ||
    name === 'gpt-6.1-sol' ||
    /^o(?:1|3|3-mini|4-mini)$/.test(name)
  ) {
    return withDefault(openaiEffort('low', 'minimum'));
  }
  return withDefault();
}

function openaiEffort(
  effort: 'none' | 'minimal' | 'low' | 'medium',
  intent: 'disabled' | 'minimum',
): ThinkingConfiguration {
  return {
    id: `thinking.openai.effort-${effort}.v1`,
    intent,
    rejectionFields: ['reasoning', 'reasoning.effort', 'reasoning_effort'],
    providerOptions: { openai: { reasoningEffort: effort } },
  };
}

function anthropicConfigurations(
  model: string,
): readonly ThinkingConfiguration[] {
  const name = model.replace(/-(?:\d{8}|latest)$/, '');
  if (name === 'claude-sonnet-5-5') {
    return withDefault(
      {
        id: 'thinking.anthropic.between-tools.v1',
        intent: 'disabled',
        rejectionFields: [
          'thinking',
          'thinking.type',
          'effort',
          'output_config',
        ],
        providerOptions: { anthropic: { effort: 'low' } },
        // The installed native SDK does not yet accept this documented thinking type.
        requestBody: { thinking: { type: 'between_tools' } },
      },
      anthropicMinimum(),
    );
  }
  if (
    /^claude-(?:(?:fable|mythos)-5(?:-1)?|opus-5-5|mythos-preview)$/.test(name)
  ) {
    return withDefault(anthropicMinimum());
  }
  if (name === 'claude-opus-5' || name === 'claude-haiku-5-5') {
    return withDefault(
      {
        ...anthropicDisabled(),
        id: 'thinking.anthropic.disabled-low.v1',
        rejectionFields: [
          'thinking',
          'thinking.type',
          'effort',
          'output_config',
        ],
        providerOptions: {
          anthropic: { thinking: { type: 'disabled' }, effort: 'low' },
        },
      },
      anthropicMinimum(),
    );
  }
  if (/^claude-(?:opus-4-[678]|sonnet-4-6|sonnet-5)$/.test(name)) {
    return withDefault(anthropicDisabled(), anthropicMinimum());
  }
  if (
    /^claude-(?:3-7-sonnet|(?:opus|sonnet|haiku)-4-5|(?:opus|sonnet)-4|opus-4-1)$/.test(
      name,
    )
  ) {
    return withDefault(anthropicDisabled());
  }
  return withDefault();
}

function anthropicDisabled(): ThinkingConfiguration {
  return {
    id: 'thinking.anthropic.disabled.v1',
    intent: 'disabled',
    rejectionFields: ['thinking', 'thinking.type'],
    providerOptions: { anthropic: { thinking: { type: 'disabled' } } },
  };
}

function anthropicMinimum(): ThinkingConfiguration {
  return {
    id: 'thinking.anthropic.adaptive-low.v1',
    intent: 'minimum',
    rejectionFields: ['thinking', 'thinking.type', 'effort', 'output_config'],
    providerOptions: {
      anthropic: { thinking: { type: 'adaptive' }, effort: 'low' },
    },
  };
}

function groqConfigurations(model: string): readonly ThinkingConfiguration[] {
  if (model === 'qwen/qwen3-32b' || /^qwen\/qwen3\.[68]-27b$/.test(model)) {
    return model === 'qwen/qwen3.8-27b'
      ? withDefault(groqEffort('none'), groqEffort('low'))
      : withDefault(groqEffort('none'));
  }
  if (
    model === 'openai/gpt-oss-20b' ||
    model === 'openai/gpt-oss-120b' ||
    model === 'meta-models/muse-spark-open'
  ) {
    return withDefault(groqEffort('low'));
  }
  return withDefault();
}

function groqEffort(effort: 'none' | 'low'): ThinkingConfiguration {
  return {
    id: `thinking.groq.effort-${effort}.v1`,
    intent: effort === 'none' ? 'disabled' : 'minimum',
    rejectionFields: ['reasoning', 'reasoning_effort'],
    // Explicit provider options bypass the SDK's outdated single-model allowlist.
    providerOptions: { groq: { reasoningEffort: effort } },
  };
}

function xaiConfigurations(model: string): readonly ThinkingConfiguration[] {
  if (/^grok-4\.3(?:-|$)/.test(model)) {
    return withDefault(xaiEffort('none'), xaiEffort('low'));
  }
  if (/^grok-4\.[567](?:-|$)/.test(model)) {
    return withDefault(xaiEffort('low'));
  }
  return withDefault();
}

function xaiEffort(effort: 'none' | 'low'): ThinkingConfiguration {
  return {
    id: `thinking.xai.effort-${effort}.v1`,
    intent: effort === 'none' ? 'disabled' : 'minimum',
    rejectionFields: ['reasoning', 'reasoning.effort', 'reasoning_effort'],
    providerOptions: { xai: { reasoningEffort: effort } },
  };
}

function mistralConfigurations(
  model: string,
): readonly ThinkingConfiguration[] {
  if (model === 'zai-glm-5-3') {
    return withDefault({
      id: 'thinking.mistral.effort-low.v1',
      intent: 'minimum',
      rejectionFields: ['reasoning', 'reasoning_effort'],
      // The installed SDK schema accepts only none/high and omits unknown models.
      requestBody: { reasoning_effort: 'low' },
    });
  }
  if (
    /^mistral-(?:small-(?:latest|2603)|medium-(?:latest|2604|3-5|3\.5)|large-4-0)$/.test(
      model,
    )
  ) {
    return withDefault({
      id: 'thinking.mistral.effort-none.v1',
      intent: 'minimum',
      rejectionFields: ['reasoning', 'reasoning_effort'],
      // Mistral describes none as minimal thinking, not guaranteed zero reasoning.
      requestBody: { reasoning_effort: 'none' },
    });
  }
  return withDefault();
}

function deepseekConfigurations(
  model: string,
): readonly ThinkingConfiguration[] {
  if (
    [
      'deepseek-flash',
      'deepseek-v4-flash',
      'deepseek-v4-flash-vision-exp',
      'deepseek-v4-pro',
    ].includes(model)
  ) {
    return withDefault(
      {
        id: 'thinking.deepseek.disabled.v1',
        intent: 'disabled',
        rejectionFields: ['thinking', 'thinking.type'],
        providerOptions: { deepseek: { thinking: { type: 'disabled' } } },
      },
      {
        id: 'thinking.deepseek.enabled-low.v1',
        intent: 'minimum',
        rejectionFields: [
          'thinking',
          'thinking.type',
          'reasoning',
          'reasoning_effort',
        ],
        providerOptions: {
          deepseek: { thinking: { type: 'enabled' }, reasoningEffort: 'low' },
        },
      },
    );
  }
  return withDefault();
}
