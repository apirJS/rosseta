import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { PuterGenerationTransport } from './PuterGenerationTransport';

export function createPuterRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const modelId = input.modelId;

  return {
    transport: new PuterGenerationTransport(
      input.credential.apiKey.value,
      modelId,
    ),
    context: createProviderContext(input, false),
  };
}
