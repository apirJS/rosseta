export interface ModelScopeInput {
    providerId: string;
    modelId: string;
    protocol: string;
    baseURL?: string;
    customConfig?: {
        id: string;
        type?: string;
        baseURL: string;
        headers?: Record<string, string>;
        queryParams?: Record<string, string>;
    };
}
export const PROVIDER_ENDPOINTS: Readonly<Record<string, string>> = {
  google: 'https://generativelanguage.googleapis.com/v1beta',
  groq: 'https://api.groq.com/openai/v1',
  xai: 'https://api.x.ai/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  deepinfra: 'https://api.deepinfra.com/v1/openai',
  zai: 'https://api.z.ai/api/paas/v4',
  openrouter: 'https://openrouter.ai/api/v1',
  opencode: 'https://opencode.ai/zen/v1',
  huggingface: 'https://router.huggingface.co/v1',
  puter: 'https://api.puter.com/drivers/call',
};

export function providerProtocol(providerId: string, customConfig?: ModelScopeInput['customConfig']): string {
  if (customConfig?.type === 'anthropic' || providerId === 'anthropic') return 'anthropic';
  if (providerId === 'google') return 'google';
  if (providerId === 'puter') return 'puter-native';
  if (providerId === 'openai') return 'openai-responses';
  return 'openai-compatible';
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

export async function capabilityDigest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function modelScopeKey(input: ModelScopeInput): Promise<string> {
  const config = input.customConfig;
  const endpoint = new URL(
    config?.baseURL ?? input.baseURL ?? PROVIDER_ENDPOINTS[input.providerId] ?? 'https://unknown.invalid',
  );
  endpoint.hash = '';
  endpoint.pathname = endpoint.pathname.replace(/\/$/, '');

  return capabilityDigest({
    providerId: input.providerId,
    modelId: input.modelId,
    protocol: input.protocol,
    endpoint: endpoint.toString(),
    configId: config?.id,
    type: config?.type,
    headers: config?.headers,
    query: config?.queryParams,
  });
}
