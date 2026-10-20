import { createDeepInfra } from '@ai-sdk/deepinfra';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createDeepInfraRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const apiKey = input.credential.apiKey.value;
  const modelId = input.modelId;

  const transport = createProviderSdkTransport(
    createDeepInfra({ apiKey })(modelId),
  );

  return {
    transport,
    context: createProviderContext(input, true),
  };
}
