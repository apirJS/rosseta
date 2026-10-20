import { createMistral } from '@ai-sdk/mistral';
import { configuredGenerationFetch } from '../requests/configured-generation-fetch';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createMistralRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const apiKey = input.credential.apiKey.value;
  const modelId = input.modelId;

  const transport = createProviderSdkTransport(
    createMistral({ apiKey })(modelId),
    {
      createModel: (configuration) =>
        createMistral({
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
