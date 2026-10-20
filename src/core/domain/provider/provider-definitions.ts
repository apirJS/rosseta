import { isProvider, type Provider } from '../credential/Provider';

export interface ProviderDefinition {
  readonly id: Provider;
  readonly name: string;
  readonly defaultModelId: string;
}

/** Built-in hints only. Persisted model catalogs and custom configurations are explicit snapshots. */
export const BUILTIN_PROVIDER_DEFINITIONS: Readonly<
  Record<Provider, ProviderDefinition>
> = Object.freeze({
  google: Object.freeze({
    id: 'google',
    name: 'Google',
    defaultModelId: 'gemini-2.5-flash',
  }),
  groq: Object.freeze({
    id: 'groq',
    name: 'Groq',
    defaultModelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
  }),
  xai: Object.freeze({ id: 'xai', name: 'xAI', defaultModelId: 'grok-3-mini' }),
  openai: Object.freeze({
    id: 'openai',
    name: 'OpenAI',
    defaultModelId: 'gpt-4o',
  }),
  anthropic: Object.freeze({
    id: 'anthropic',
    name: 'Anthropic',
    defaultModelId: 'claude-sonnet-4-20250514',
  }),
  mistral: Object.freeze({
    id: 'mistral',
    name: 'Mistral',
    defaultModelId: 'mistral-large-latest',
  }),
  deepinfra: Object.freeze({
    id: 'deepinfra',
    name: 'DeepInfra',
    defaultModelId: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct',
  }),
  zai: Object.freeze({ id: 'zai', name: 'Z.ai', defaultModelId: 'glm-4.5v' }),
  openrouter: Object.freeze({
    id: 'openrouter',
    name: 'OpenRouter',
    defaultModelId: 'google/gemini-2.5-flash',
  }),
  opencode: Object.freeze({
    id: 'opencode',
    name: 'OpenCode',
    defaultModelId: 'deepseek-v4-flash-vision-exp',
  }),
  huggingface: Object.freeze({
    id: 'huggingface',
    name: 'Hugging Face',
    defaultModelId: 'Qwen/Qwen2.5-VL-72B-Instruct',
  }),
  puter: Object.freeze({ id: 'puter', name: 'PuterJS', defaultModelId: '' }),
  deepseek: Object.freeze({
    id: 'deepseek',
    name: 'DeepSeek',
    defaultModelId: 'deepseek-flash',
  }),
  nvidia: Object.freeze({
    id: 'nvidia',
    name: 'NVIDIA',
    defaultModelId: 'meta/llama-3.2-11b-vision-instruct',
  }),
});

export function getProviderDefinition(
  provider: string,
): ProviderDefinition | undefined {
  return isProvider(provider)
    ? BUILTIN_PROVIDER_DEFINITIONS[provider]
    : undefined;
}

export function getProviderDefaultModelId(provider: string): string {
  return getProviderDefinition(provider)?.defaultModelId ?? '';
}
