import { isCustomProviderId } from './CustomProviderConfig';

export interface ProviderConfig {
  id: string;
  name: string;
  defaultModelId: string;
  models: Array<{ id: string; name: string }>;
}

const configs = new Map<string, ProviderConfig>();
let customIds = new Set<string>();
let modelEntriesCache: Record<
  string,
  { name: string; provider: string }
> | null = null;

export const ProviderRegistry = {
  register(config: ProviderConfig): void {
    configs.set(config.id, config);
    modelEntriesCache = null;
  },

  getConfig(provider: string): ProviderConfig {
    const config = configs.get(provider);
    if (!config) throw new Error(`Unknown provider: ${provider}`);
    return config;
  },

  getDefaultModelId(provider: string): string {
    return configs.get(provider)?.defaultModelId ?? '';
  },

  syncCustomProviders(providers: Array<{ id: string; name: string }>): void {
    const customs = providers.filter((provider) =>
      isCustomProviderId(provider.id),
    );
    const nextIds = new Set(customs.map((provider) => provider.id));

    for (const id of customIds) {
      if (!nextIds.has(id)) configs.delete(id);
    }
    customIds = nextIds;

    for (const provider of customs) {
      const existing = configs.get(provider.id);
      configs.set(provider.id, {
        id: provider.id,
        name: provider.name,
        defaultModelId: '',
        models: existing?.models ?? [],
      });
    }
    modelEntriesCache = null;
  },

  getModelsForProvider(provider: string): Array<{ id: string; name: string }> {
    return [...ProviderRegistry.getConfig(provider).models];
  },

  setModels(
    provider: string,
    models: Array<{ id: string; name: string }>,
  ): void {
    const config = configs.get(provider);
    if (config) {
      config.models = models;
      modelEntriesCache = null;
    }
  },

  addModel(
    provider: string,
    model: { id: string; name: string },
  ): void {
    const config = configs.get(provider);
    if (config && !config.models.some((entry) => entry.id === model.id)) {
      config.models = [...config.models, model];
      modelEntriesCache = null;
    }
  },

  removeModel(provider: string, modelId: string): void {
    const config = configs.get(provider);
    if (config && config.models.some((model) => model.id === modelId)) {
      config.models = config.models.filter((model) => model.id !== modelId);
      modelEntriesCache = null;
    }
  },

  getAllModelEntries(): Record<string, { name: string; provider: string }> {
    if (!modelEntriesCache) {
      const entries: Record<string, { name: string; provider: string }> = {};
      for (const config of configs.values()) {
        for (const model of config.models) {
          entries[model.id] = { name: model.name, provider: config.id };
        }
      }
      modelEntriesCache = entries;
    }
    return modelEntriesCache;
  },

  getAllProviders(): ProviderConfig[] {
    return Array.from(configs.values());
  },

  hasProvider(provider: string): boolean {
    return configs.has(provider);
  },
};

ProviderRegistry.register({
  id: 'google',
  name: 'Google',
  defaultModelId: 'gemini-2.5-flash',
  models: [],
});

ProviderRegistry.register({
  id: 'groq',
  name: 'Groq',
  defaultModelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
  models: [],
});

ProviderRegistry.register({
  id: 'xai',
  name: 'xAI',
  defaultModelId: 'grok-3-mini',
  models: [],
});

ProviderRegistry.register({
  id: 'openai',
  name: 'OpenAI',
  defaultModelId: 'gpt-4o',
  models: [],
});

ProviderRegistry.register({
  id: 'anthropic',
  name: 'Anthropic',
  defaultModelId: 'claude-sonnet-4-20250514',
  models: [],
});

ProviderRegistry.register({
  id: 'mistral',
  name: 'Mistral',
  defaultModelId: 'mistral-large-latest',
  models: [],
});

ProviderRegistry.register({
  id: 'deepinfra',
  name: 'DeepInfra',
  defaultModelId: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct',
  models: [],
});

ProviderRegistry.register({
  id: 'zai',
  name: 'Z.ai',
  defaultModelId: 'glm-4.5v',
  models: [],
});

ProviderRegistry.register({
  id: 'openrouter',
  name: 'OpenRouter',
  defaultModelId: 'google/gemini-2.5-flash',
  models: [],
});

ProviderRegistry.register({
  id: 'opencode',
  name: 'OpenCode',
  defaultModelId: 'deepseek-v4-flash-vision-exp',
  models: [],
});

ProviderRegistry.register({
  id: 'huggingface',
  name: 'Hugging Face',
  defaultModelId: 'Qwen/Qwen2.5-VL-72B-Instruct',
  models: [],
});

ProviderRegistry.register({
  id: 'puter',
  name: 'PuterJS',
  defaultModelId: '',
  models: [],
});
