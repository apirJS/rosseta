import type { Provider } from '../credential/Provider';
import { isCustomProviderId } from './CustomProviderConfig';

export interface ProviderConfig {
  id: string;
  name: string;
  defaultModelId: string;
  models: Array<{ id: string; name: string }>;
}

export class ProviderRegistry {
  private static readonly configs = new Map<string, ProviderConfig>();
  private static customIds = new Set<string>();
  private static modelEntriesCache: Record<
    string,
    { name: string; provider: string }
  > | null = null;

  static register(config: ProviderConfig): void {
    this.configs.set(config.id, config);
    this.modelEntriesCache = null;
  }

  static getConfig(provider: string): ProviderConfig {
    const config = this.configs.get(provider);
    if (!config) throw new Error(`Unknown provider: ${provider}`);
    return config;
  }

  static getDefaultModelId(provider: string): string {
    return this.configs.get(provider)?.defaultModelId ?? '';
  }

  static syncCustomProviders(
    providers: Array<{ id: string; name: string }>,
  ): void {
    const customs = providers.filter((p) => isCustomProviderId(p.id));
    const nextIds = new Set(customs.map((p) => p.id));

    for (const id of this.customIds) {
      if (!nextIds.has(id)) this.configs.delete(id);
    }
    this.customIds = nextIds;

    for (const provider of customs) {
      const existing = this.configs.get(provider.id);
      this.configs.set(provider.id, {
        id: provider.id,
        name: provider.name,
        defaultModelId: '',
        models: existing?.models ?? [],
      });
    }
    this.modelEntriesCache = null;
  }

  static getModelsForProvider(
    provider: string,
  ): Array<{ id: string; name: string }> {
    return [...this.getConfig(provider).models];
  }

  static setModels(
    provider: string,
    models: Array<{ id: string; name: string }>,
  ): void {
    const config = this.configs.get(provider);
    if (config) {
      config.models = models;
      this.modelEntriesCache = null;
    }
  }

  static addModel(
    provider: string,
    model: { id: string; name: string },
  ): void {
    const config = this.configs.get(provider);
    if (config && !config.models.some((m) => m.id === model.id)) {
      config.models = [...config.models, model];
      this.modelEntriesCache = null;
    }
  }

  static removeModel(provider: string, modelId: string): void {
    const config = this.configs.get(provider);
    if (config && config.models.some((m) => m.id === modelId)) {
      config.models = config.models.filter((m) => m.id !== modelId);
      this.modelEntriesCache = null;
    }
  }

  static getAllModelEntries(): Record<
    string,
    { name: string; provider: string }
  > {
    if (!this.modelEntriesCache) {
      const entries: Record<string, { name: string; provider: string }> = {};
      for (const config of this.configs.values()) {
        for (const model of config.models) {
          entries[model.id] = { name: model.name, provider: config.id };
        }
      }
      this.modelEntriesCache = entries;
    }
    return this.modelEntriesCache;
  }

  static getAllProviders(): ProviderConfig[] {
    return Array.from(this.configs.values());
  }

  static hasProvider(provider: string): boolean {
    return this.configs.has(provider);
  }
}

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
