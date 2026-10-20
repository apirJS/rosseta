import { createDeepSeek } from '@ai-sdk/deepseek';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';
import type { GenerationMode } from '../../translation/transports/GenerationTransport';

const DEEPSEEK_MODES: readonly GenerationMode[] = [
  'plain-stream',
  'plain-buffered',
];

export function createDeepSeekRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const provider = createDeepSeek({ apiKey: input.credential.apiKey.value });
  const modelId = input.modelId;

  return {
    transport: createProviderSdkTransport(provider(modelId), {
      supportedModes: DEEPSEEK_MODES,
    }),
    context: createProviderContext(input, false),
  };
}
