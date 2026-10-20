import { beforeEach, describe, expect, spyOn, test } from 'bun:test';
import puterSdk from '@heyputer/puter.js';
import { createTranslationAdapter } from '../TranslationAdapterFactory';
import { ApiKey } from '../../../core/domain/credential/ApiKey';
import { Credential } from '../../../core/domain/credential/Credential';
import type { AnyProvider } from '../../../core/domain/credential/Provider';
import { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import { CustomProviderConfig } from '../../../core/domain/provider/CustomProviderConfig';
import { AbortCancellationToken } from '../../primary/background/services/AbortCancellationToken';
import type { TranslationProgress } from '../../../core/ports/outbound/TranslationExecutionOptions';
import { success } from '../../../shared/types/Result';
import { ErrorCode } from '../../../shared/errors';
import {
  generateTextMock,
  resetStreamTextMock,
} from '../../../../tests/browser-mock';
import { FakeTranslationCapabilityStorage } from '../../../../tests/fakes/FakeTranslationCapabilityStorage';
import {
  TARGET_LANGUAGE,
  VALID_IMAGE,
  VALID_PAIRED_TRANSLATION_RESPONSE,
} from '../../../../tests/test-fixtures';
import { modelScopeKey, providerProtocol } from './translation-capability-key';

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
  'custom-contract-openai',
  'custom-contract-anthropic',
  'puter',
] as const;

function setup(provider: (typeof providers)[number]) {
  const key = ApiKey.createWithProvider(
    'contract-test-credential',
    provider as AnyProvider,
  );
  if (!key.success) throw key.error;

  const credential = Credential.create(
    crypto.randomUUID(),
    key.data,
    provider as AnyProvider,
  );
  if (!credential.success) throw credential.error;

  let config: CustomProviderConfig | undefined;
  if (provider.startsWith('custom-')) {
    const result = CustomProviderConfig.create({
      id: provider,
      name: 'Contract endpoint',
      type: provider.endsWith('anthropic') ? 'anthropic' : 'openai-compatible',
      baseURL: 'https://contract.invalid/v1',
      headers: { 'X-Routing': 'region-one' },
      queryParams: { apiVersion: 'fixture' },
    });
    if (!result.success) throw result.error;

    config = result.data;
  }
  const modelId = `vision-${provider}`;
  const preferences = UserPreferences.createDefault(
    crypto.randomUUID(),
  ).withSelectedModel(provider, modelId);
  const storage = new FakeTranslationCapabilityStorage();

  return {
    storage,
    config,
    modelId,
    service: createTranslationAdapter(
      credential.data,
      preferences,
      config,
      storage,
    ),
  };
}

describe('Adapter: all provider translation contracts', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    resetStreamTextMock();
    generateTextMock.mockResolvedValue({
      text: JSON.stringify(VALID_PAIRED_TRANSLATION_RESPONSE),
      output: VALID_PAIRED_TRANSLATION_RESPONSE,
      finishReason: 'stop',
    });
  });

  test.each([...providers])(
    '%s forwards generic progress/model/image and durable provider identity',
    async (provider) => {
      const { storage, config, modelId, service } = setup(provider);
      const progress: TranslationProgress[] = [];
      const chat =
        provider === 'puter'
          ? spyOn(puterSdk.ai, 'chat').mockResolvedValueOnce(
              (async function* () {
                yield {
                  type: 'text',
                  text: JSON.stringify(VALID_PAIRED_TRANSLATION_RESPONSE),
                };
              })() as never,
            )
          : null;

      const token =
        provider === 'puter'
          ? spyOn(puterSdk, 'setAuthToken').mockImplementation((value) => {
              puterSdk.authToken = value;
            })
          : null;

      try {
        const result = await service.translateImage(
          VALID_IMAGE,
          TARGET_LANGUAGE,
          {
            generationDeadlineAt: Date.now() + 5000,
            progress: {
              report: async (event) => {
                progress.push(event);
                return success(undefined);
              },
            },
          },
        );

        expect(result.success).toBe(true);
        expect(progress[0].kind).toBe('reset');
        expect(progress.some((event) => event.kind === 'snapshot')).toBe(true);

        const identity = await modelScopeKey({
          providerId: provider,
          modelId,
          protocol: providerProtocol(provider, config),
          customConfig: config,
        });

        expect(storage.records.has(identity)).toBe(true);

        if (result.success) {
          expect(result.data.translated[0].text).toBe('Hello');
        }

        if (chat) {
          const call = chat.mock.calls[0] as unknown as [
            string,
            string,
            Record<string, unknown>,
          ];

          expect(call[1]).toBe(VALID_IMAGE.value);
          expect(call[2]).toMatchObject({ model: modelId });
        } else {
          const options = generateTextMock.mock.calls[0][0] as {
            reasoning: string;
            model: { modelId: string };
            messages: {
              content: { type: string; data?: { data: string } }[];
            }[];
          };

          expect(options.model.modelId).toBe(modelId);
          expect(options.messages[0].content[1].data?.data).toBe(
            VALID_IMAGE.base64Data,
          );

          if (provider === 'deepseek') {
            expect('output' in options).toBe(false);
            expect(
              storage.records.get(identity)?.facts['feature.structured']
                .support,
            ).toBe('unknown');
          }
        }
      } finally {
        chat?.mockRestore();
        token?.mockRestore();
      }
    },
  );

  test.each([...providers])(
    '%s honors generic cancellation during the reset gate without a provider request',
    async (provider) => {
      const { service } = setup(provider);
      const token = new AbortCancellationToken();
      const chat = spyOn(puterSdk.ai, 'chat');
      try {
        const result = await service.translateImage(
          VALID_IMAGE,
          TARGET_LANGUAGE,
          {
            cancellationToken: token,
            progress: {
              report: async () => {
                token.cancel();
                return success(undefined);
              },
            },
          },
        );

        expect(result.success).toBe(false);
        if (!result.success)
          expect(result.error.code).toBe(ErrorCode.TRANSLATION_CANCELLED);

        expect(generateTextMock).not.toHaveBeenCalled();
        expect(chat).not.toHaveBeenCalled();
      } finally {
        chat.mockRestore();
      }
    },
  );
});
