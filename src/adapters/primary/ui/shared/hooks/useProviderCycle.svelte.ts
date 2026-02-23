import { ProviderRegistry } from '../../../../../core/domain/provider/ProviderRegistry';

interface ProviderInfo {
  id: string;
  name: string;
  apiKeyUrl: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    name: ProviderRegistry.getConfig('gemini').name,
    apiKeyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'groq',
    name: ProviderRegistry.getConfig('groq').name,
    apiKeyUrl: 'https://console.groq.com/keys',
  },
];

const CYCLE_INTERVAL_MS = 3000;

export class ProviderCycleState {
  index = $state(0);
  current = $derived(PROVIDERS[this.index]);
}

export function useProviderCycle() {
  const state = new ProviderCycleState();

  const interval = setInterval(() => {
    state.index = (state.index + 1) % PROVIDERS.length;
  }, CYCLE_INTERVAL_MS);

  $effect(() => {
    return () => clearInterval(interval);
  });

  return state;
}
