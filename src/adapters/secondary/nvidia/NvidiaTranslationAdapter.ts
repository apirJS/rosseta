import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { Credential } from '../../../core/domain/credential/Credential';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import type { Language } from '../../../core/domain/translation/Language';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { ITranslationCapabilityStorage } from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import type { TranslationExecutionOptions } from '../../../core/ports/outbound/TranslationExecutionOptions';
import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';
import { executeTranslation } from '../shared/ai-sdk-translation';
import { AiSdkGenerationTransport } from '../shared/AiSdkGenerationTransport';
import { PROVIDER_ENDPOINTS, providerProtocol } from '../shared/translation-capability-key';

export class NvidiaTranslationAdapter implements ITranslationService {
  constructor(
    private readonly credential: Credential,
    private readonly preferences: UserPreferences,
    private readonly capabilities: ITranslationCapabilityStorage,
  ) {}

  async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
    options?: TranslationExecutionOptions,
  ): Promise<Result<Translation, AppError>> {
    const provider = createOpenAICompatible({
      name: 'NVIDIA',
      baseURL: PROVIDER_ENDPOINTS.nvidia,
      apiKey: this.credential.apiKey.value,
      supportsStructuredOutputs: true,
    });
    const modelId = this.preferences.getModelIdFor(this.credential.provider);

    return executeTranslation(
      new AiSdkGenerationTransport(provider(modelId)),
      { providerId: this.credential.provider, modelId, protocol: providerProtocol(this.credential.provider) },
      image,
      targetLanguage,
      this.preferences.includeDescription,
      this.capabilities,
      options,
    );
  }
}
