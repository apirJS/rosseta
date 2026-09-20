import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { generateTextMock } from '../../../../tests/browser-mock';
import {
  VALID_TRANSLATION_RESPONSE,
  VALID_IMAGE,
  TARGET_LANGUAGE,
} from '../../../../tests/test-fixtures';
import { ApiKey } from '../../../core/domain/credential/ApiKey';
import { Credential } from '../../../core/domain/credential/Credential';
import { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import { FakeStructuredOutputExemptionStorage } from '../../../../tests/fakes/FakeStructuredOutputExemptionStorage';
import { v4 as uuidv4 } from 'uuid';

interface CapturedProviderOptions {
  name: string;
  baseURL: string;
  apiKey: string;
  headers: Record<string, string>;
}

const createOpenAICompatibleMock = mock(
  (_options: CapturedProviderOptions) => (modelId: string) => ({ modelId }),
);

mock.module('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: createOpenAICompatibleMock,
}));

const { OpenCodeTranslationAdapter } = await import('./OpenCodeTranslationAdapter');

type OpenCodeAdapter = InstanceType<typeof OpenCodeTranslationAdapter>;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createAdapter(): OpenCodeAdapter {
  const apiKey = ApiKey.createWithProvider('zen-test-key', 'opencode');
  if (!apiKey.success) throw new Error('bad key');

  const credential = Credential.create(uuidv4(), apiKey.data, 'opencode');
  if (!credential.success) throw new Error('bad credential');

  return new OpenCodeTranslationAdapter(
    credential.data,
    UserPreferences.createDefault(uuidv4()),
    new FakeStructuredOutputExemptionStorage(),
  );
}

function capturedOptionsAt(index: number): CapturedProviderOptions {
  return createOpenAICompatibleMock.mock.calls[index][0];
}

describe('Adapter: OpenCodeTranslationAdapter', () => {
  beforeEach(() => {
    createOpenAICompatibleMock.mockClear();
    generateTextMock.mockReset();
    generateTextMock.mockResolvedValueOnce({
      output: VALID_TRANSLATION_RESPONSE,
    });
  });

  test('translates via the OpenAI-compatible provider', async () => {
    const result = await createAdapter().translateImage(
      VALID_IMAGE,
      TARGET_LANGUAGE,
    );

    expect(result.success).toBe(true);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  test('targets the Zen relay with the credential api key', async () => {
    await createAdapter().translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    const options = capturedOptionsAt(0);
    expect(options.name).toBe('OpenCode');
    expect(options.baseURL).toBe('https://opencode.ai/zen/v1');
    expect(options.apiKey).toBe('zen-test-key');
  });

  test('sends the free-tier session id and attribution headers', async () => {
    await createAdapter().translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    const { headers } = capturedOptionsAt(0);
    expect(headers['X-Session-ID']).toMatch(UUID_V4_PATTERN);
    expect(headers['User-Agent']).toMatch(/^opencode\/\d+\.\d+\.\d+$/);
    expect(headers['HTTP-Referer']).toBe('https://opencode.ai/');
    expect(headers['X-Title']).toBe('opencode');
  });

  test('reuses the same session id across requests', async () => {
    const adapter = createAdapter();
    await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);
    generateTextMock.mockResolvedValueOnce({
      output: VALID_TRANSLATION_RESPONSE,
    });
    await adapter.translateImage(VALID_IMAGE, TARGET_LANGUAGE);

    expect(capturedOptionsAt(0).headers['X-Session-ID']).toBe(
      capturedOptionsAt(1).headers['X-Session-ID'],
    );
  });
});
