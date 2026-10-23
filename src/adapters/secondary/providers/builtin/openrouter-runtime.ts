import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createOpenRouterRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const openrouter = createOpenRouter({
    apiKey: input.credential.apiKey.value,
  });

  const model = openrouter(input.modelId);

  return {
    transport: createProviderSdkTransport(model),
    context: createProviderContext(input, true),
  };
}
