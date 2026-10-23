import { createAnthropic } from '@ai-sdk/anthropic';
import { configuredGenerationFetch } from '../requests/configured-generation-fetch';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createAnthropicRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const apiKey = input.credential.apiKey.value;
  const modelId = input.modelId;

  const transport = createProviderSdkTransport(
    createAnthropic({ apiKey })(modelId),
    {
      structuredProviderOptions: {
        anthropic: { structuredOutputMode: 'outputFormat' },
      },
      createModel: (configuration) =>
        createAnthropic({
          apiKey,
          fetch: configuredGenerationFetch(configuration.requestBody),
        })(modelId),
    },
  );

  return {
    transport,
    context: createProviderContext(input, true),
  };
}
