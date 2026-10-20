import { isCustomProviderId } from '../../../core/domain/provider/CustomProviderConfig';
import type { ITranslationCapabilityStorage } from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import { TranslationServiceAdapter } from '../translation/TranslationServiceAdapter';
import type { ProviderRuntime, ProviderRuntimeInput } from './ProviderRuntime';
import { createGoogleRuntime } from './builtin/google-runtime';
import { createGroqRuntime } from './builtin/groq-runtime';
import { createXaiRuntime } from './builtin/xai-runtime';
import { createOpenAIRuntime } from './builtin/openai-runtime';
import { createAnthropicRuntime } from './builtin/anthropic-runtime';
import { createMistralRuntime } from './builtin/mistral-runtime';
import { createDeepInfraRuntime } from './builtin/deepinfra-runtime';
import { createDeepSeekRuntime } from './builtin/deepseek-runtime';
import { createNvidiaRuntime } from './builtin/nvidia-runtime';
import { createZaiRuntime } from './builtin/zai-runtime';
import { createOpenRouterRuntime } from './builtin/openrouter-runtime';
import { createOpenCodeRuntime } from './builtin/opencode-runtime';
import { createHuggingFaceRuntime } from './builtin/huggingface-runtime';
import { createPuterRuntime } from './puter/puter-runtime';
import { createOpenAICompatibleRuntime } from './custom/openai-compatible-runtime';
import { createAnthropicCompatibleRuntime } from './custom/anthropic-compatible-runtime';

export type { ProviderRuntime, ProviderRuntimeInput } from './ProviderRuntime';

export function createProviderRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const provider = input.credential.provider;

  if (isCustomProviderId(provider)) {
    const customProviderConfig = requireCustomConfiguration(input);
    const customInput = { ...input, customProviderConfig };

    return customProviderConfig.type === 'anthropic'
      ? createAnthropicCompatibleRuntime(customInput)
      : createOpenAICompatibleRuntime(customInput);
  }

  switch (provider) {
    case 'google':
      return createGoogleRuntime(input);

    case 'groq':
      return createGroqRuntime(input);

    case 'xai':
      return createXaiRuntime(input);

    case 'openai':
      return createOpenAIRuntime(input);

    case 'anthropic':
      return createAnthropicRuntime(input);

    case 'mistral':
      return createMistralRuntime(input);

    case 'deepinfra':
      return createDeepInfraRuntime(input);

    case 'deepseek':
      return createDeepSeekRuntime(input);

    case 'nvidia':
      return createNvidiaRuntime(input);

    case 'zai':
      return createZaiRuntime(input);

    case 'openrouter':
      return createOpenRouterRuntime(input);

    case 'opencode':
      return createOpenCodeRuntime(input);

    case 'huggingface':
      return createHuggingFaceRuntime(input);

    case 'puter':
      return createPuterRuntime(input);

    default: {
      const exhaustiveProvider: never = provider;

      throw new Error(`Unknown provider: ${exhaustiveProvider}`);
    }
  }
}

export function createTranslationService(
  input: ProviderRuntimeInput & { readonly includeDescription: boolean },
  capabilities: ITranslationCapabilityStorage,
): ITranslationService {
  if (isCustomProviderId(input.credential.provider))
    requireCustomConfiguration(input);

  return new TranslationServiceAdapter(
    () => createProviderRuntime(input),
    input.includeDescription,
    capabilities,
  );
}

function requireCustomConfiguration(input: ProviderRuntimeInput) {
  if (!input.customProviderConfig)
    throw new Error('Custom provider config is required for custom providers');

  return input.customProviderConfig;
}
