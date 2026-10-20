import { createGoogle } from '@ai-sdk/google';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

export function createGoogleRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const google = createGoogle({
    apiKey: input.credential.apiKey.value,
  });

  const model = google(input.modelId);

  return {
    transport: createProviderSdkTransport(model),
    context: createProviderContext(input, true),
  };
}
