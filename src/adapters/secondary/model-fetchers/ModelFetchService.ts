import type {
  IModelFetchService,
  ModelInfo,
} from '../../../core/ports/outbound/IModelFetchService';
import {
  success,
  failure,
  type Result,
} from '../../../shared/types/Result';
import {
  AppError,
  AuthError,
  ErrorCode,
  NetworkError,
  ValidationError,
} from '../../../shared/errors';
import { isCustomProviderId } from '../../../core/domain/provider/CustomProviderConfig';
import type { CustomProviderType } from '../../../core/domain/provider/CustomProviderConfig';
import { buildCustomProviderURL } from '../shared/custom-provider-request';
import puterSdk from '@heyputer/puter.js';

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly url: string,
    readonly responseBody?: string,
  ) {
    super(`${status} ${statusText}${responseBody ? `: ${responseBody}` : ''}`);
    this.name = 'HttpError';
  }
}

async function assertOk(response: Response, url: string): Promise<void> {
  if (!response.ok) {
    let responseBody: string | undefined;
    try {
      responseBody = (await response.text()).slice(0, 2000);
    } catch {
      responseBody = undefined;
    }
    throw new HttpError(
      response.status,
      response.statusText,
      url,
      responseBody,
    );
  }
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Provider returned invalid JSON');
  }
}

interface OpenAIModelEntry {
  id: string;
  object?: string;
}

interface OpenAIModelsResponse {
  data?: OpenAIModelEntry[];
}

async function fetchOpenAICompatibleModels(
  apiKey: string,
  baseURL: string,
  customHeaders?: Record<string, string>,
  queryParams?: Record<string, string>,
): Promise<ModelInfo[]> {
  const requestURL = buildCustomProviderURL(baseURL, 'models', queryParams);

  const headers: Record<string, string> = { ...customHeaders };
  const hasAuthorization = Object.keys(headers).some(
    (name) => name.toLowerCase() === 'authorization',
  );
  if (apiKey && !hasAuthorization) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(requestURL, { headers });
  await assertOk(response, requestURL);

  const json = (await parseJson(response)) as OpenAIModelsResponse;
  const data = Array.isArray(json?.data) ? json.data : [];

  return data
    .filter((m) => m.object === undefined || m.object === 'model')
    .map((m) => ({ id: m.id, name: m.id }))
    .toSorted((a, b) => a.id.localeCompare(b.id));
}

async function fetchAnthropicCompatibleModels(
  apiKey: string,
  baseURL: string,
  customHeaders?: Record<string, string>,
  queryParams?: Record<string, string>,
): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];

  async function fetchPage(
    cursor: string | undefined,
    remainingPages: number,
  ): Promise<void> {
    if (remainingPages === 0) return;

    const pageQueryParams = {
      limit: '100',
      ...queryParams,
      ...(cursor ? { after_id: cursor } : {}),
    };
    const requestURL = buildCustomProviderURL(
      baseURL,
      'models',
      pageQueryParams,
    );
    const headers: Record<string, string> = {
      'anthropic-version': '2023-06-01',
      ...customHeaders,
    };
    if (
      apiKey &&
      !Object.keys(headers).some((name) => name.toLowerCase() === 'x-api-key')
    ) {
      headers['x-api-key'] = apiKey;
    }

    const response = await fetch(requestURL, { headers });
    await assertOk(response, requestURL);
    const json = (await parseJson(response)) as AnthropicModelsResponse;
    const data = Array.isArray(json?.data) ? json.data : [];
    models.push(
      ...data.map((model) => ({
        id: model.id,
        name: model.display_name || model.id,
      })),
    );

    if (json.has_more && json.last_id) {
      await fetchPage(json.last_id, remainingPages - 1);
    }
  }

  await fetchPage(undefined, ANTHROPIC_MAX_PAGES);

  return models.toSorted((a, b) => a.name.localeCompare(b.name));
}

interface GeminiModelEntry {
  name: string;
  displayName: string;
  supportedGenerationMethods?: string[];
}

interface GeminiModelsResponse {
  models?: GeminiModelEntry[];
}

async function fetchGoogleModels(apiKey: string): Promise<ModelInfo[]> {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models';

  const response = await fetch(url, {
    headers: {
      'x-goog-api-key': apiKey,
    },
  });
  await assertOk(response, url);

  const json = (await parseJson(response)) as GeminiModelsResponse;
  const models = Array.isArray(json?.models) ? json.models : [];

  return models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({
      id: m.name.replace('models/', ''),
      name: m.displayName,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

interface AnthropicModelEntry {
  id: string;
  display_name?: string;
}

interface AnthropicModelsResponse {
  data?: AnthropicModelEntry[];
  has_more?: boolean;
  last_id?: string;
}

const ANTHROPIC_MAX_PAGES = 10;

async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];

  async function fetchPage(
    cursor: string | undefined,
    remainingPages: number,
  ): Promise<void> {
    if (remainingPages === 0) return;

    const url = new URL('https://api.anthropic.com/v1/models');
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('after_id', cursor);

    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    await assertOk(response, url.toString());

    const json = (await parseJson(response)) as AnthropicModelsResponse;
    const data = Array.isArray(json?.data) ? json.data : [];

    for (const m of data) {
      models.push({ id: m.id, name: m.display_name || m.id });
    }

    if (json.has_more && json.last_id) {
      await fetchPage(json.last_id, remainingPages - 1);
    }
  }

  await fetchPage(undefined, ANTHROPIC_MAX_PAGES);

  return models.toSorted((a, b) => a.name.localeCompare(b.name));
}

type ModelFetcher = (
  apiKey: string,
  baseURL?: string,
) => Promise<ModelInfo[]>;

async function fetchPuterModels(apiKey: string): Promise<ModelInfo[]> {
  if (puterSdk.authToken !== apiKey) {
    puterSdk.setAuthToken(apiKey);
  }

  await puterSdk.auth.getUser();
  const rawModels = await puterSdk.ai.listModels();

  return rawModels
    .filter((model): model is Record<string, unknown> =>
      typeof model === 'object' && model !== null,
    )
    .flatMap((model) => {
      const id = typeof model.id === 'string' ? model.id : null;

      if (!id) return [];

      const name = typeof model.name === 'string' ? model.name : id;
      const provider =
        typeof model.provider === 'string' ? model.provider : null;

      return [{ id, name: provider ? name + ' (' + provider + ')' : name }];
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

function mapStructuredProviderError(
  provider: string,
  error: unknown,
): AppError | null {
  if (typeof error !== 'object' || error === null) return null;
  const root = error as Record<string, unknown>;
  const nested =
    typeof root.error === 'object' && root.error !== null
      ? (root.error as Record<string, unknown>)
      : null;
  const status = Number(root.status ?? nested?.status ?? root.statusCode);
  const code = String(root.code ?? nested?.code ?? '').toLowerCase();
  const message = String(
    root.message ?? nested?.message ?? root.reason ?? '',
  );

  if (status === 401 || /auth|token|unauthori[sz]|reauth/.test(code)) {
    if (provider === 'puter') {
      return new AuthError({
        code: ErrorCode.AUTH_INVALID_API_KEY,
        userMessage:
          'Invalid Puter token. Copy a fresh token from Puter account settings.',
      });
    }
    return AuthError.invalidApiKey();
  }

  if (
    status === 402 ||
    /insufficient_funds|usage_limit|usage_limited|payment_required/.test(code)
  ) {
    return AuthError.paymentRequired();
  }
  
  if (
    status === 403 ||
    /permission_denied|forbidden|access_denied/.test(code)
  ) {
    return AuthError.accessDenied();
  }

  if (status === 429 || /rate_limit|rate_limited|too_many_requests/.test(code)) {
    return NetworkError.rateLimited();
  }

  if (status >= 500) return NetworkError.providerUnavailable(status);

  if (status === 404) {
    return ValidationError.invalidInput(
      'No models were found for ' +
        provider +
        '. Check the provider token and try again.',
      { provider, status },
    );
  }

  if (/invalid_request|bad_request|unsupported/.test(code)) {
    return ValidationError.invalidInput(
      message || 'The ' + provider + ' model endpoint rejected the request.',
      { provider, code },
    );
  }
  
  if (
    status === 0 &&
    ('readyState' in root || 'responseText' in root || 'statusText' in root)
  ) {
    return NetworkError.connectionFailed();
  }
  return null;
}

const MODEL_FETCHERS: Record<string, ModelFetcher> = {
  google: (apiKey) => fetchGoogleModels(apiKey),
  openai: (apiKey) =>
    fetchOpenAICompatibleModels(apiKey, 'https://api.openai.com/v1'),
  groq: (apiKey) =>
    fetchOpenAICompatibleModels(apiKey, 'https://api.groq.com/openai/v1'),
  xai: (apiKey) => fetchOpenAICompatibleModels(apiKey, 'https://api.x.ai/v1'),
  mistral: (apiKey) =>
    fetchOpenAICompatibleModels(apiKey, 'https://api.mistral.ai/v1'),
  deepinfra: (apiKey) =>
    fetchOpenAICompatibleModels(apiKey, 'https://api.deepinfra.com/v1/openai'),
  zai: (apiKey) =>
    fetchOpenAICompatibleModels(apiKey, 'https://api.z.ai/api/paas/v4'),
  openrouter: (apiKey) =>
    fetchOpenAICompatibleModels(apiKey, 'https://openrouter.ai/api/v1'),
  opencode: (apiKey) =>
    fetchOpenAICompatibleModels(apiKey, 'https://opencode.ai/zen/v1'),
  huggingface: (apiKey) =>
    fetchOpenAICompatibleModels(apiKey, 'https://router.huggingface.co/v1'),
  anthropic: (apiKey) => fetchAnthropicModels(apiKey),
  puter: (apiKey) => fetchPuterModels(apiKey),
};

export class ModelFetchService implements IModelFetchService {
  canFetch(provider: string): boolean {
    return isCustomProviderId(provider) || provider in MODEL_FETCHERS;
  }

  async fetchModels(
    provider: string,
    apiKey: string,
    baseURL?: string,
    headers?: Record<string, string>,
    queryParams?: Record<string, string>,
    customProviderType?: CustomProviderType,
  ): Promise<Result<ModelInfo[], AppError>> {
    if (isCustomProviderId(provider)) {
      if (!baseURL) {
        return failure(
          ValidationError.invalidInput(
            'Custom provider has no base URL configured.',
            { provider },
          ),
        );
      }
      return this.run(
        () => customProviderType === 'anthropic'
          ? fetchAnthropicCompatibleModels(apiKey, baseURL, headers, queryParams)
          : fetchOpenAICompatibleModels(apiKey, baseURL, headers, queryParams),
        provider,
      );
    }

    const fetcher = MODEL_FETCHERS[provider];
    if (!fetcher) {
      return failure(
        ValidationError.invalidInput(
          `Model fetching is not supported for this provider. Add models manually.`,
          { provider },
        ),
      );
    }

    return this.run(() => fetcher(apiKey, baseURL), provider);
  }

  private async run(
    fetch: () => Promise<ModelInfo[]>,
    provider: string,
  ): Promise<Result<ModelInfo[], AppError>> {
    try {
      const models = await fetch();
      return success(models);
    } catch (error) {
      return failure(this.toAppError(provider, error));
    }
  }

  private toAppError(provider: string, error: unknown): AppError {
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403) {
        return error.status === 403
          ? AuthError.accessDenied()
          : AuthError.invalidApiKey();
      }
      if (error.status === 402) return AuthError.paymentRequired();
      if (error.status === 429) {
        return NetworkError.rateLimited(error.url);
      }
      if (error.status >= 500) {
        return NetworkError.providerUnavailable(error.status, error.url);
      }
      if (error.status === 404) {
        return ValidationError.invalidInput(
          `No models were found at the ${provider} endpoint. Check the base URL and path.`,
          { provider, status: error.status, url: error.url },
        );
      }
      if (error.status === 400 || error.status === 422) {
        return ValidationError.invalidInput(
          `The ${provider} endpoint rejected the model list request. Check the base URL, headers, query parameters, and API key.`,
          { provider, status: error.status, url: error.url },
        );
      }
      return NetworkError.serverError(error.status, error.url);
    }

    const structuredError = mapStructuredProviderError(provider, error);
    if (structuredError) return structuredError;

    if (
      error instanceof TypeError ||
      (error instanceof Error && /failed to fetch|network error/i.test(error.message))
    ) {
      return NetworkError.connectionFailed(undefined, error);
    }

    if (error instanceof Error && /invalid JSON/i.test(error.message)) {
      return NetworkError.invalidResponse();
    }

    return AppError.fromUnknown(error);
  }
}
