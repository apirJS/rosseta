import type { ITranslationService } from '../../core/ports/outbound/ITranslationService';
import type { Credential } from '../../core/domain/credential/Credential';
import type { UserPreferences } from '../../core/domain/preferences/UserPreferences';
import type { CustomProviderConfig } from '../../core/domain/provider/CustomProviderConfig';
import { isCustomProviderId } from '../../core/domain/provider/CustomProviderConfig';
import { GoogleTranslationAdapter } from './google/GoogleTranslationAdapter';
import { GroqTranslationAdapter } from './groq/GroqTranslationAdapter';
import { XaiTranslationAdapter } from './xai/XaiTranslationAdapter';
import { OpenAITranslationAdapter } from './openai/OpenAITranslationAdapter';
import { AnthropicTranslationAdapter } from './anthropic/AnthropicTranslationAdapter';
import { MistralTranslationAdapter } from './mistral/MistralTranslationAdapter';
import { DeepInfraTranslationAdapter } from './deepinfra/DeepInfraTranslationAdapter';
import { ZaiTranslationAdapter } from './zai/ZaiTranslationAdapter';
import { OpenRouterTranslationAdapter } from './openrouter/OpenRouterTranslationAdapter';
import { OpenAICompatibleTranslationAdapter } from './openai-compatible/OpenAICompatibleTranslationAdapter';

export function createTranslationAdapter(
  credential: Credential,
  preferences: UserPreferences,
  customProviderConfig?: CustomProviderConfig,
): ITranslationService {
  if (isCustomProviderId(credential.provider)) {
    if (!customProviderConfig) {
      throw new Error(
        'Custom provider config is required for custom providers',
      );
    }
    return new OpenAICompatibleTranslationAdapter(
      credential,
      preferences,
      customProviderConfig,
    );
  }

  switch (credential.provider) {
    case 'google':
      return new GoogleTranslationAdapter(credential, preferences);
    case 'groq':
      return new GroqTranslationAdapter(credential, preferences);
    case 'xai':
      return new XaiTranslationAdapter(credential, preferences);
    case 'openai':
      return new OpenAITranslationAdapter(credential, preferences);
    case 'anthropic':
      return new AnthropicTranslationAdapter(credential, preferences);
    case 'mistral':
      return new MistralTranslationAdapter(credential, preferences);
    case 'deepinfra':
      return new DeepInfraTranslationAdapter(credential, preferences);
    case 'zai':
      return new ZaiTranslationAdapter(credential, preferences);
    case 'openrouter':
      return new OpenRouterTranslationAdapter(credential, preferences);
    default: {
      const _exhaustive: never = credential.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}
