import { isCustomProviderId } from '../provider/CustomProviderConfig';

export type Provider =
  | 'google'
  | 'groq'
  | 'xai'
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'deepinfra'
  | 'zai'
  | 'openrouter'
  | 'opencode'
  | 'huggingface';

export const PROVIDERS: Provider[] = [
  'google',
  'groq',
  'xai',
  'openai',
  'anthropic',
  'mistral',
  'deepinfra',
  'zai',
  'openrouter',
  'opencode',
  'huggingface',
];

export const DEFAULT_PROVIDER: Provider = 'google';

export type AnyProvider = Provider | `custom-${string}`;

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as string[]).includes(value);
}

export function isAnyProvider(value: string): value is AnyProvider {
  return isProvider(value) || isCustomProviderId(value);
}
