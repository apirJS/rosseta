import { createGroq } from '@ai-sdk/groq';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createGroqRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const groq = createGroq({
    apiKey: input.credential.apiKey.value,
  });

  const model = groq(input.modelId);

  return {
    transport: createProviderSdkTransport(model),
    context: createProviderContext(input, true),
  };
}
