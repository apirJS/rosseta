import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import type { TranslationExecutionOptions } from '../../../core/ports/outbound/TranslationExecutionOptions';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { Credential } from '../../../core/domain/credential/Credential';
import type { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import type { CustomProviderConfig } from '../../../core/domain/provider/CustomProviderConfig';
import type { ITranslationCapabilityStorage } from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import { executeTranslation } from '../shared/ai-sdk-translation';
import { AiSdkGenerationTransport } from '../shared/AiSdkGenerationTransport';
import { providerProtocol } from '../shared/translation-capability-key';
import { configuredGenerationFetch } from '../shared/configured-generation-fetch';
export class OpenAICompatibleTranslationAdapter implements ITranslationService {
  constructor(
    private readonly credential: Credential,
    private readonly userPreferences: UserPreferences,
    private readonly providerConfig: CustomProviderConfig,
    private readonly capabilities: ITranslationCapabilityStorage,
  ) {}

  async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
    options?: TranslationExecutionOptions,
  ): Promise<Result<Translation, AppError>> {
    const modelId = this.userPreferences.getModelIdFor(
      this.credential.provider,
    );
    const settings = {
      name: this.providerConfig.name,
      baseURL: this.providerConfig.baseURL,
      apiKey: this.credential.apiKey.value,
      headers: this.providerConfig.headers,
      queryParams: this.providerConfig.queryParams,
      supportsStructuredOutputs: true,
    };
    const transport = new AiSdkGenerationTransport(
      createOpenAICompatible(settings)(modelId),
      {
        thinkingContext: {
          provider: this.credential.provider,
          modelId,
          baseURL: settings.baseURL,
          providerName: settings.name,
          protocol: 'openai-compatible',
        },
        createModel: (configuration) =>
          createOpenAICompatible({
            ...settings,
            fetch: configuredGenerationFetch(configuration.requestBody),
          })(modelId),
      },
    );
    return executeTranslation(
      transport,
      {
        providerId: this.credential.provider,
        modelId,
        protocol: providerProtocol(
          this.credential.provider,
          this.providerConfig,
        ),
        customConfig: this.providerConfig,
      },
      image,
      targetLanguage,
      this.userPreferences.includeDescription,
      this.capabilities,
      options,
    );
  }
}
