import { describe, expect, test, beforeEach, afterEach, spyOn } from 'bun:test';
import { ModelFetchService } from './ModelFetchService';
import { AuthError, NetworkError, ValidationError, ErrorCode } from '../../../shared/errors';

describe('Adapter: ModelFetchService', () => {
  let service: ModelFetchService;
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    service = new ModelFetchService();
    fetchSpy = spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
    });
  }

  test('canFetch is true for all supported providers', () => {
    for (const provider of [
      'google',
      'openai',
      'groq',
      'xai',
      'mistral',
      'deepinfra',
      'anthropic',
      'zai',
      'openrouter',
      'opencode',
      'huggingface',
    ]) {
      expect(service.canFetch(provider)).toBe(true);
    }
    expect(service.canFetch('custom-openrouter')).toBe(true);
    expect(service.canFetch('unknown-provider')).toBe(false);
  });

  test('fetchModels returns sorted models for OpenAI-style endpoints', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { id: 'zeta-model', object: 'model' },
          { id: 'alpha-model', object: 'model' },
          { id: 'not-a-model', object: 'embedding' },
        ],
      }),
    );

    const result = await service.fetchModels('groq', 'gsk_key');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((m) => m.id)).toEqual([
        'alpha-model',
        'zeta-model',
      ]);
    }
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('https://api.groq.com/openai/v1/models');
    expect(init.headers.Authorization).toBe('Bearer gsk_key');
  });

  test('fetchModels tolerates entries without an object field', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ data: [{ id: 'some-model' }] }),
    );

    const result = await service.fetchModels('mistral', 'key');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
  });

  test('fetchModels hits the Z.ai OpenAI-compatible endpoint', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ data: [{ id: 'glm-4.5v', object: 'model' }] }),
    );

    const result = await service.fetchModels('zai', 'zai-key');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((m) => m.id)).toEqual(['glm-4.5v']);
    }
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('https://api.z.ai/api/paas/v4/models');
    expect(init.headers.Authorization).toBe('Bearer zai-key');
  });

  test('fetchModels hits the OpenRouter OpenAI-compatible endpoint', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: 'google/gemini-2.5-flash', object: 'model' }],
      }),
    );

    const result = await service.fetchModels('openrouter', 'or-key');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((m) => m.id)).toEqual([
        'google/gemini-2.5-flash',
      ]);
    }
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('https://openrouter.ai/api/v1/models');
    expect(init.headers.Authorization).toBe('Bearer or-key');
  });

  test('fetchModels hits the OpenCode Zen OpenAI-compatible endpoint', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: 'deepseek-v4-flash-vision-exp', object: 'model' }],
      }),
    );

    const result = await service.fetchModels('opencode', 'zen-key');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((m) => m.id)).toEqual([
        'deepseek-v4-flash-vision-exp',
      ]);
    }
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('https://opencode.ai/zen/v1/models');
    expect(init.headers.Authorization).toBe('Bearer zen-key');
  });

  test('fetchModels hits the Hugging Face router OpenAI-compatible endpoint', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { id: 'Qwen/Qwen2.5-VL-72B-Instruct', object: 'model' },
          { id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct', object: 'model' },
        ],
      }),
    );

    const result = await service.fetchModels('huggingface', 'hf_key');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((m) => m.id)).toEqual([
        'meta-llama/Llama-4-Maverick-17B-128E-Instruct',
        'Qwen/Qwen2.5-VL-72B-Instruct',
      ]);
    }
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('https://router.huggingface.co/v1/models');
    expect(init.headers.Authorization).toBe('Bearer hf_key');
  });

  test('fetchModels tolerates malformed response shape', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({}));

    const result = await service.fetchModels('openai', 'key');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });

  test('fetchModels sends Google key via header, not query string', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        models: [
          {
            name: 'models/gemini-2.5-flash',
            displayName: 'Gemini 2.5 Flash',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/embedding-001',
            displayName: 'Embedding',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      }),
    );

    const result = await service.fetchModels('google', 'AIzaKey');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('gemini-2.5-flash');
    }
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).not.toContain('AIzaKey');
    expect(init.headers['x-goog-api-key']).toBe('AIzaKey');
  });

  test('fetchModels paginates Anthropic results', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 'claude-1', display_name: 'Claude 1' }],
          has_more: true,
          last_id: 'claude-1',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 'claude-2', display_name: 'Claude 2' }],
          has_more: false,
        }),
      );

    const result = await service.fetchModels('anthropic', 'sk-ant-key');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((m) => m.id)).toEqual(['claude-1', 'claude-2']);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const secondUrl = fetchSpy.mock.calls[1][0] as unknown as URL | string;
    expect(String(secondUrl)).toContain('after_id=claude-1');
  });

  test('fetchModels requires baseURL for custom providers', async () => {
    const result = await service.fetchModels(
      'custom-my-endpoint',
      'key',
      undefined,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  test('fetchModels uses baseURL for custom providers', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ data: [{ id: 'custom-model', object: 'model' }] }),
    );

    const result = await service.fetchModels(
      'custom-my-endpoint',
      'key',
      'https://my-endpoint.example/v1/',
    );

    expect(result.success).toBe(true);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://my-endpoint.example/v1/models',
    );
  });

  test('fetchModels sends no auth header for keyless custom providers', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ data: [{ id: 'local-model', object: 'model' }] }),
    );

    const result = await service.fetchModels(
      'custom-ollama',
      '',
      'http://localhost:11434/v1',
    );

    expect(result.success).toBe(true);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers.Authorization).toBeUndefined();
  });

  test('maps 401 to AuthError', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({}, 401));

    const result = await service.fetchModels('openai', 'bad-key');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthError);
      expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
    }
  });

  test('maps 429 to rate-limit NetworkError', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({}, 429));

    const result = await service.fetchModels('openai', 'key');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NetworkError);
    }
  });

  test('maps 500 to provider-unavailable NetworkError with status', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({}, 500));

    const result = await service.fetchModels('openai', 'key');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NetworkError);
      expect(result.error.code).toBe(ErrorCode.NETWORK_PROVIDER_UNAVAILABLE);
      expect(result.error.context).toMatchObject({ status: 500 });
    }
  });

  test('returns ValidationError for unknown provider', async () => {
    const result = await service.fetchModels('unknown-provider', 'key');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  test('maps network failure to AppError without throwing', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));

    const result = await service.fetchModels('openai', 'key');

    expect(result.success).toBe(false);
  });

  test('maps invalid JSON to a failure without throwing', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('not json', { status: 200 }),
    );

    const result = await service.fetchModels('openai', 'key');

    expect(result.success).toBe(false);
  });
});
