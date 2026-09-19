import type { ITranslationService } from '../../core/ports/outbound/ITranslationService';
import type { Credential } from '../../core/domain/credential/Credential';
import type { UserPreferences } from '../../core/domain/preferences/UserPreferences';
import type { CustomProviderConfig } from '../../core/domain/provider/CustomProviderConfig';
import { isCustomProviderId } from '../../core/domain/provider/CustomProviderConfig';
import type { IStructuredOutputExemptionStorage } from '../../core/ports/outbound/IStructuredOutputExemptionStorage';
import { GoogleTranslationAdapter } from './google/GoogleTranslationAdapter';
import { GroqTranslationAdapter } from './groq/GroqTranslationAdapter';
import { XaiTranslationAdapter } from './xai/XaiTranslationAdapter';
import { OpenAITranslationAdapter } from './openai/OpenAITranslationAdapter';
import { AnthropicTranslationAdapter } from './anthropic/AnthropicTranslationAdapter';
import { MistralTranslationAdapter } from './mistral/MistralTranslationAdapter';
import { DeepInfraTranslationAdapter } from './deepinfra/DeepInfraTranslationAdapter';
import { ZaiTranslationAdapter } from './zai/ZaiTranslationAdapter';
import { OpenRouterTranslationAdapter } from './openrouter/OpenRouterTranslationAdapter';
import { OpenCodeTranslationAdapter } from './opencode/OpenCodeTranslationAdapter';
import { HuggingFaceTranslationAdapter } from './huggingface/HuggingFaceTranslationAdapter';
import { OpenAICompatibleTranslationAdapter } from './openai-compatible/OpenAICompatibleTranslationAdapter';
import { AnthropicCompatibleTranslationAdapter } from './anthropic-compatible/AnthropicCompatibleTranslationAdapter';

export function createTranslationAdapter(
  credential: Credential,
  preferences: UserPreferences,
  customProviderConfig: CustomProviderConfig | undefined,
  structuredOutputExemptions: IStructuredOutputExemptionStorage,
): ITranslationService {
  if (isCustomProviderId(credential.provider)) {
    if (!customProviderConfig) {
      throw new Error(
        'Custom provider config is required for custom providers',
      );
    }
    const Adapter = customProviderConfig.type === 'anthropic'
      ? AnthropicCompatibleTranslationAdapter
      : OpenAICompatibleTranslationAdapter;
    return new Adapter(
      credential,
      preferences,
      customProviderConfig,
      structuredOutputExemptions,
    );
  }

  switch (credential.provider) {
    case 'google':
      return new GoogleTranslationAdapter(credential, preferences, structuredOutputExemptions);
    case 'groq':
      return new GroqTranslationAdapter(credential, preferences, structuredOutputExemptions);
    case 'xai':
      return new XaiTranslationAdapter(credential, preferences, structuredOutputExemptions);
    case 'openai':
      return new OpenAITranslationAdapter(credential, preferences, structuredOutputExemptions);
    case 'anthropic':
      return new AnthropicTranslationAdapter(credential, preferences, structuredOutputExemptions);
    case 'mistral':
      return new MistralTranslationAdapter(credential, preferences, structuredOutputExemptions);
    case 'deepinfra':
      return new DeepInfraTranslationAdapter(credential, preferences, structuredOutputExemptions);
    case 'zai':
      return new ZaiTranslationAdapter(credential, preferences, structuredOutputExemptions);
    case 'openrouter':
      return new OpenRouterTranslationAdapter(credential, preferences, structuredOutputExemptions);
    case 'opencode':
      return new OpenCodeTranslationAdapter(credential, preferences, structuredOutputExemptions);
    case 'huggingface':
      return new HuggingFaceTranslationAdapter(credential, preferences, structuredOutputExemptions);
    default: {
      const _exhaustive: never = credential.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}
