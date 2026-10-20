import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { configuredGenerationFetch } from '../requests/configured-generation-fetch';
import {
  createProviderContext,
  type CustomProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createOpenAICompatibleRuntime(
  input: CustomProviderRuntimeInput,
): ProviderRuntime {
  const modelId = input.modelId;

  const settings = {
    name: input.customProviderConfig.name,
    baseURL: input.customProviderConfig.baseURL,
    apiKey: input.credential.apiKey.value,
    headers: input.customProviderConfig.headers,
    queryParams: input.customProviderConfig.queryParams,
    supportsStructuredOutputs: true,
  };

  const transport = createProviderSdkTransport(
    createOpenAICompatible(settings)(modelId),
    {
      thinkingContext: {
        provider: input.credential.provider,
        modelId,
        baseURL: settings.baseURL,
        providerName: settings.name,
        protocol: 'openai-compatible',
      },
      createModel: (configuration) =>
        createOpenAICompatible({
          ...settings,
          fetch: configuredGenerationFetch(configuration.requestBody),
        })(modelId),
    },
  );

  return {
    transport,
    context: createProviderContext(input, false),
  };
}
