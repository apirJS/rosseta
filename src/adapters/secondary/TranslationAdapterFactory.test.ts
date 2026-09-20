import { describe, expect, test } from 'bun:test';
import { createTranslationAdapter } from './TranslationAdapterFactory';
import { GoogleTranslationAdapter } from './google/GoogleTranslationAdapter';
import { GroqTranslationAdapter } from './groq/GroqTranslationAdapter';
import { XaiTranslationAdapter } from './xai/XaiTranslationAdapter';
import { OpenAITranslationAdapter } from './openai/OpenAITranslationAdapter';
import { AnthropicTranslationAdapter } from './anthropic/AnthropicTranslationAdapter';
import { MistralTranslationAdapter } from './mistral/MistralTranslationAdapter';
import { DeepInfraTranslationAdapter } from './deepinfra/DeepInfraTranslationAdapter';
import { ZaiTranslationAdapter } from './zai/ZaiTranslationAdapter';
import { OpenRouterTranslationAdapter } from './openrouter/OpenRouterTranslationAdapter';
import { OpenCodeTranslationAdapter } from './opencode/OpenCodeTranslationAdapter';
import { HuggingFaceTranslationAdapter } from './huggingface/HuggingFaceTranslationAdapter';
import { OpenAICompatibleTranslationAdapter } from './openai-compatible/OpenAICompatibleTranslationAdapter';
import { PuterTranslationAdapter } from './puter/PuterTranslationAdapter';
import { CustomProviderConfig } from '../../core/domain/provider/CustomProviderConfig';
import { Credential } from '../../core/domain/credential/Credential';
import { UserPreferences } from '../../core/domain/preferences/UserPreferences';
import { ApiKey } from '../../core/domain/credential/ApiKey';
import { v4 as uuidv4 } from 'uuid';
import type { Provider } from '../../core/domain/credential/Provider';
import type { ITranslationService } from '../../core/ports/outbound/ITranslationService';
import { FakeStructuredOutputExemptionStorage } from '../../../tests/fakes/FakeStructuredOutputExemptionStorage';

function createCredential(provider: string) {
  const apiKey = ApiKey.createWithProvider('test-key-value-12345', provider as never);
  if (!apiKey.success) throw new Error('bad key');

  const cred = Credential.create(uuidv4(), apiKey.data, provider as never);
  if (!cred.success) throw new Error('bad cred');

  return cred.data;
}

function createCustomConfig() {
  const result = CustomProviderConfig.create({
    id: 'custom-factory-1',
    name: 'My Provider',
    baseURL: 'https://api.example.com/v1',
  });
  if (!result.success) throw new Error('bad config');
  return result.data;
}

describe('Adapter: TranslationAdapterFactory', () => {
  const preferences = UserPreferences.createDefault(uuidv4());

  const expectedAdapters: Record<
    Provider,
    new (...args: never[]) => ITranslationService
  > = {
    google: GoogleTranslationAdapter,
    groq: GroqTranslationAdapter,
    xai: XaiTranslationAdapter,
    openai: OpenAITranslationAdapter,
    anthropic: AnthropicTranslationAdapter,
    mistral: MistralTranslationAdapter,
    deepinfra: DeepInfraTranslationAdapter,
    zai: ZaiTranslationAdapter,
    openrouter: OpenRouterTranslationAdapter,
    opencode: OpenCodeTranslationAdapter,
    huggingface: HuggingFaceTranslationAdapter,
    puter: PuterTranslationAdapter,
  };

  for (const provider of Object.keys(expectedAdapters) as Provider[]) {
    const expected = expectedAdapters[provider];

    test(`returns ${expected.name} for ${provider} provider`, () => {
      const adapter = createTranslationAdapter(
        createCredential(provider),
        preferences,
        undefined,
        new FakeStructuredOutputExemptionStorage(),
      );
      expect(adapter).toBeInstanceOf(expected);
    });
  }

  test('returns OpenAICompatibleTranslationAdapter for a custom provider with config', () => {
    const adapter = createTranslationAdapter(
      createCredential('custom-factory-1'),
      preferences,
      createCustomConfig(),
      new FakeStructuredOutputExemptionStorage(),
    );
    expect(adapter).toBeInstanceOf(OpenAICompatibleTranslationAdapter);
  });

  test('throws for a custom provider without config', () => {
    expect(() =>
      createTranslationAdapter(
        createCredential('custom-factory-1'),
        preferences,
        undefined,
        new FakeStructuredOutputExemptionStorage(),
      ),
    ).toThrow('Custom provider config is required');
  });
});
