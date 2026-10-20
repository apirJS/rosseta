import { createAnthropic } from '@ai-sdk/anthropic';
import { createQueryParamFetch } from '../requests/custom-provider-request';
import { configuredGenerationFetch } from '../requests/configured-generation-fetch';
import {
  createProviderContext,
  type CustomProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createAnthropicCompatibleRuntime(
  input: CustomProviderRuntimeInput,
): ProviderRuntime {
  const modelId = input.modelId;

  const queryFetch = createQueryParamFetch(
    input.customProviderConfig.queryParams,
  );

  const settings = {
    name: input.customProviderConfig.name,
    baseURL: input.customProviderConfig.baseURL,
    apiKey: input.credential.apiKey.value,
    headers: input.customProviderConfig.headers,
    fetch: queryFetch,
  };

  const transport = createProviderSdkTransport(
    createAnthropic(settings)(modelId),
    {
      structuredProviderOptions: {
        anthropic: { structuredOutputMode: 'outputFormat' },
      },
      thinkingContext: {
        provider: input.credential.provider,
        modelId,
        baseURL: settings.baseURL,
        providerName: settings.name,
        protocol: 'anthropic',
      },
      createModel: (configuration) =>
        createAnthropic({
          ...settings,
          fetch:
            configuredGenerationFetch(configuration.requestBody, queryFetch) ??
            queryFetch,
        })(modelId),
    },
  );

  return {
    transport,
    context: createProviderContext(input, false),
  };
}
