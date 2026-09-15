import type { Provider } from '../../../../../core/domain/credential/Provider';

export const PROVIDER_BADGE_COLORS: Record<string, string> = {
  google: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  groq: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  xai: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
  openai: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  anthropic: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  mistral: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  deepinfra: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  zai: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  openrouter: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  opencode: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400',
  'custom-provider':
    'bg-violet-500/15 text-violet-600 dark:text-violet-400',
};

export const API_KEY_URLS: Partial<Record<Provider, string>> = {
  google: 'https://aistudio.google.com/apikey',
  groq: 'https://console.groq.com/keys',
  xai: 'https://console.x.ai',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  mistral: 'https://console.mistral.ai/api-keys/',
  deepinfra: 'https://deepinfra.com/dash/api_keys',
  zai: 'https://z.ai/manage-apikey',
  openrouter: 'https://openrouter.ai/settings/keys',
  opencode: 'https://opencode.ai/auth',
};
