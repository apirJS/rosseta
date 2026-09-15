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
  NetworkError,
  ValidationError,
} from '../../../shared/errors';
import { isCustomProviderId } from '../../../core/domain/provider/CustomProviderConfig';

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly url: string,
  ) {
    super(`${status} ${statusText}`);
    this.name = 'HttpError';
  }
}

async function assertOk(response: Response, url: string): Promise<void> {
  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, url);
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
): Promise<ModelInfo[]> {
  const base = baseURL.replace(/\/$/, '');
  const url = `${base}/models`;

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, { headers });
  await assertOk(response, url);

  const json = (await parseJson(response)) as OpenAIModelsResponse;
  const data = Array.isArray(json?.data) ? json.data : [];

  return data
    .filter((m) => m.object === undefined || m.object === 'model')
    .map((m) => ({ id: m.id, name: m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
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
    .sort((a, b) => a.name.localeCompare(b.name));
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
  let cursor: string | undefined;

  for (let page = 0; page < ANTHROPIC_MAX_PAGES; page++) {
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

    if (!json.has_more || !json.last_id) break;
    cursor = json.last_id;
  }

  return models.sort((a, b) => a.name.localeCompare(b.name));
}

type ModelFetcher = (
  apiKey: string,
  baseURL?: string,
) => Promise<ModelInfo[]>;

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
  anthropic: (apiKey) => fetchAnthropicModels(apiKey),
};

export class ModelFetchService implements IModelFetchService {
  canFetch(provider: string): boolean {
    return isCustomProviderId(provider) || provider in MODEL_FETCHERS;
  }

  async fetchModels(
    provider: string,
    apiKey: string,
    baseURL?: string,
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
        () => fetchOpenAICompatibleModels(apiKey, baseURL),
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
        return AuthError.invalidApiKey();
      }
      if (error.status === 429) {
        return new NetworkError({
          message: 'Rate limited. Wait a moment and try again.',
          context: { provider, status: error.status, url: error.url },
        });
      }
      return NetworkError.serverError(error.status, error.url);
    }

    return AppError.fromUnknown(error);
  }
}
