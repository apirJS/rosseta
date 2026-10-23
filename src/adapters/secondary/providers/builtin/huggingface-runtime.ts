import { createHuggingFace } from '@ai-sdk/huggingface';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createHuggingFaceRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const huggingface = createHuggingFace({
    apiKey: input.credential.apiKey.value,
  });

  const model = huggingface(input.modelId);

  return {
    transport: createProviderSdkTransport(model),
    context: createProviderContext(input, true),
  };
}
