import type { ModelScopeInput } from '../transports/GenerationTransport';
import { PROVIDER_ENDPOINTS } from '../../providers/provider-connection';

export type { ModelScopeInput } from '../transports/GenerationTransport';

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

  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

export async function modelScopeKey(input: ModelScopeInput): Promise<string> {
  const config = input.customConfig;

  const endpoint = new URL(
    config?.baseURL ??
      input.baseURL ??
      PROVIDER_ENDPOINTS[input.providerId] ??
      'https://unknown.invalid',
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
