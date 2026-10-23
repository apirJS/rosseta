import { createZai } from '@ai-sdk/zai';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createZaiRuntime(input: ProviderRuntimeInput): ProviderRuntime {
  const zai = createZai({
    apiKey: input.credential.apiKey.value,
  });

  const model = zai(input.modelId);

  return {
    transport: createProviderSdkTransport(model),
    context: createProviderContext(input, true),
  };
}
