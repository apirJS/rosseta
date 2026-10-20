import { createOpenAI } from '@ai-sdk/openai';
import { configuredGenerationFetch } from '../requests/configured-generation-fetch';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createOpenAIRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const apiKey = input.credential.apiKey.value;
  const modelId = input.modelId;

  const transport = createProviderSdkTransport(
    createOpenAI({ apiKey })(modelId),
    {
      createModel: (configuration) =>
        createOpenAI({
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
