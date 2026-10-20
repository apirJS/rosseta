import { createXai } from '@ai-sdk/xai';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createXaiRuntime(input: ProviderRuntimeInput): ProviderRuntime {
  const xai = createXai({
    apiKey: input.credential.apiKey.value,
  });

  const model = xai(input.modelId);

  return {
    transport: createProviderSdkTransport(model),
    context: createProviderContext(input, true),
  };
}
