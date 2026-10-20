import { describe, expect, test } from 'bun:test';
import {
  createProviderRuntime,
  createTranslationService,
} from './create-provider-runtime';
import { CustomProviderConfig } from '../../../core/domain/provider/CustomProviderConfig';
import { Credential } from '../../../core/domain/credential/Credential';
import { ApiKey } from '../../../core/domain/credential/ApiKey';
import type {
  AnyProvider,
  Provider,
} from '../../../core/domain/credential/Provider';
import { providerProtocol } from '../translation/compatibility/translation-capability-key';
import { FakeTranslationCapabilityStorage } from '../../../../tests/fakes/FakeTranslationCapabilityStorage';

function credential(provider: AnyProvider) {
  const key = ApiKey.createWithProvider('test-key-value-12345', provider);

  if (!key.success) throw key.error;

  const result = Credential.create(crypto.randomUUID(), key.data, provider);

  if (!result.success) throw result.error;

  return result.data;
}

const providers = [
  'google',
  'groq',
  'xai',
  'openai',
  'anthropic',
  'mistral',
  'deepinfra',
  'deepseek',
  'nvidia',
  'zai',
  'openrouter',
  'opencode',
  'huggingface',
  'puter',
] as const satisfies readonly Provider[];

describe('Adapter: explicit provider runtime construction', () => {
  test.each([...providers])(
    '%s retains provider/model identity and declared generation support',
    (provider) => {
      const runtime = createProviderRuntime({
        credential: credential(provider),
        modelId: 'fixture-vision',
      });

      expect(runtime.context).toEqual({
        providerId: provider,
        modelId: 'fixture-vision',
        protocol: providerProtocol(provider),
        ...(['deepseek', 'nvidia', 'puter'].includes(provider)
          ? {}
          : { legacyUnambiguous: true }),
      });

      expect(typeof runtime.transport.generate).toBe('function');
      if (provider === 'deepseek' || provider === 'puter')
        expect(runtime.transport.supportedModes).toEqual([
          'plain-stream',
          'plain-buffered',
        ]);
    },
  );

  test.each(['openai-compatible', 'anthropic'] as const)(
    'custom %s retains endpoint configuration',
    (type) => {
      const config = CustomProviderConfig.create({
        id: 'custom-factory-1',
        name: 'Fixture',
        type,
        baseURL: 'https://example.invalid/v1',
        headers: { 'X-Fixture': 'one' },
        queryParams: { version: 'one' },
      });

      if (!config.success) throw config.error;

      const runtime = createProviderRuntime({
        credential: credential('custom-factory-1'),
        modelId: 'fixture-vision',
        customProviderConfig: config.data,
      });

      expect(runtime.context).toEqual({
        providerId: 'custom-factory-1',
        modelId: 'fixture-vision',
        protocol: type,
        customConfig: config.data,
      });
    },
  );

  test('missing custom configuration fails before service execution', () => {
    const input = {
      credential: credential('custom-factory-1'),
      modelId: 'fixture-vision',
      includeDescription: false,
    };

    expect(() => createProviderRuntime(input)).toThrow(
      'Custom provider config is required',
    );

    expect(() =>
      createTranslationService(input, new FakeTranslationCapabilityStorage()),
    ).toThrow('Custom provider config is required');
  });
});
