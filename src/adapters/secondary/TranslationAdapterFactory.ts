import type { ITranslationService } from "../../core/ports/outbound/ITranslationService";
import type { Credential } from "../../core/domain/credential/Credential";
import type { UserPreferences } from "../../core/domain/preferences/UserPreferences";
import type { CustomProviderConfig } from "../../core/domain/provider/CustomProviderConfig";
import { isCustomProviderId } from "../../core/domain/provider/CustomProviderConfig";
import type { ITranslationCapabilityStorage } from "../../core/ports/outbound/ITranslationCapabilityStorage";
import { GoogleTranslationAdapter } from "./google/GoogleTranslationAdapter";
import { GroqTranslationAdapter } from "./groq/GroqTranslationAdapter";
import { XaiTranslationAdapter } from "./xai/XaiTranslationAdapter";
import { OpenAITranslationAdapter } from "./openai/OpenAITranslationAdapter";
import { AnthropicTranslationAdapter } from "./anthropic/AnthropicTranslationAdapter";
import { MistralTranslationAdapter } from "./mistral/MistralTranslationAdapter";
import { DeepInfraTranslationAdapter } from "./deepinfra/DeepInfraTranslationAdapter";
import { ZaiTranslationAdapter } from "./zai/ZaiTranslationAdapter";
import { OpenRouterTranslationAdapter } from "./openrouter/OpenRouterTranslationAdapter";
import { OpenCodeTranslationAdapter } from "./opencode/OpenCodeTranslationAdapter";
import { HuggingFaceTranslationAdapter } from "./huggingface/HuggingFaceTranslationAdapter";
import { OpenAICompatibleTranslationAdapter } from "./openai-compatible/OpenAICompatibleTranslationAdapter";
import { AnthropicCompatibleTranslationAdapter } from "./anthropic-compatible/AnthropicCompatibleTranslationAdapter";
import { PuterTranslationAdapter } from "./puter/PuterTranslationAdapter";
import { DeepSeekTranslationAdapter } from "./deepseek/DeepSeekTranslationAdapter";
import { NvidiaTranslationAdapter } from "./nvidia/NvidiaTranslationAdapter";

export function createTranslationAdapter(
  credential: Credential,
  preferences: UserPreferences,
  customProviderConfig: CustomProviderConfig | undefined,
  capabilities: ITranslationCapabilityStorage,
): ITranslationService {
  if (isCustomProviderId(credential.provider)) {
    if (!customProviderConfig) {
      throw new Error(
        "Custom provider config is required for custom providers",
      );
    }
    
    const Adapter =
      customProviderConfig.type === "anthropic"
        ? AnthropicCompatibleTranslationAdapter
        : OpenAICompatibleTranslationAdapter;
    
    return new Adapter(
      credential,
      preferences,
      customProviderConfig,
      capabilities,
    );
  }
  
  switch (credential.provider) {
    case "google":
      return new GoogleTranslationAdapter(
        credential,
        preferences,
        capabilities,
      );
    case "groq":
      return new GroqTranslationAdapter(credential, preferences, capabilities);
    case "xai":
      return new XaiTranslationAdapter(credential, preferences, capabilities);
    case "openai":
      return new OpenAITranslationAdapter(
        credential,
        preferences,
        capabilities,
      );
    case "anthropic":
      return new AnthropicTranslationAdapter(
        credential,
        preferences,
        capabilities,
      );
    case "mistral":
      return new MistralTranslationAdapter(
        credential,
        preferences,
        capabilities,
      );
    case "deepinfra":
      return new DeepInfraTranslationAdapter(
        credential,
        preferences,
        capabilities,
      );
    case "deepseek":
      return new DeepSeekTranslationAdapter(
        credential,
        preferences,
        capabilities,
      );
    case "nvidia":
      return new NvidiaTranslationAdapter(
        credential,
        preferences,
        capabilities,
      );
    case "zai":
      return new ZaiTranslationAdapter(credential, preferences, capabilities);
    case "openrouter":
      return new OpenRouterTranslationAdapter(
        credential,
        preferences,
        capabilities,
      );
    case "opencode":
      return new OpenCodeTranslationAdapter(
        credential,
        preferences,
        capabilities,
      );
    case "huggingface":
      return new HuggingFaceTranslationAdapter(
        credential,
        preferences,
        capabilities,
      );
    case "puter":
      return new PuterTranslationAdapter(credential, preferences, capabilities);
    default: {
      const exhaustiveProvider: never = credential.provider;
      throw new Error(`Unknown provider: ${exhaustiveProvider}`);
    }
  }
}
