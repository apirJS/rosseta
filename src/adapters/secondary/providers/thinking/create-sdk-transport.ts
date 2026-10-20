import type { LanguageModel } from 'ai';
import {
  AiSdkGenerationTransport,
  type TransportOptions,
} from '../../translation/transports/ai-sdk/AiSdkGenerationTransport';
import type { ThinkingContext } from '../../translation/transports/ai-sdk/sdk-generation-configurations';
import { thinkingConfigurations } from './thinking-configurations';

interface ProviderTransportOptions extends TransportOptions {
  thinkingContext?: ThinkingContext;
}

/** Provider routing belongs to construction; the SDK transport receives declared controls. */
export function createProviderSdkTransport(
  model: LanguageModel,
  options: ProviderTransportOptions = {},
): AiSdkGenerationTransport {
  const { thinkingContext, ...transportOptions } = options;

  const inferredContext =
    typeof model === 'object'
      ? {
          provider: model.provider.replace(/\.[^.]+$/, '').toLowerCase(),
          modelId: model.modelId,
        }
      : { provider: '', modelId: model };

  return new AiSdkGenerationTransport(model, {
    ...transportOptions,
    configurations:
      options.configurations ??
      thinkingConfigurations(thinkingContext ?? inferredContext),
  });
}
