import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';
import { PROVIDER_ENDPOINTS } from '../provider-connection';

export function createNvidiaRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const provider = createOpenAICompatible({
    name: 'NVIDIA',
    baseURL: PROVIDER_ENDPOINTS.nvidia,
    apiKey: input.credential.apiKey.value,
    supportsStructuredOutputs: true,
  });

  const modelId = input.modelId;

  return {
    transport: createProviderSdkTransport(provider(modelId), {
      thinkingContext: {
        provider: 'nvidia',
        modelId,
        providerName: 'NVIDIA',
        baseURL: PROVIDER_ENDPOINTS.nvidia,
      },
    }),
    context: createProviderContext(input, false),
  };
}
