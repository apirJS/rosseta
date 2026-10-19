import { createDeepSeek } from '@ai-sdk/deepseek';
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
import type { GenerationMode } from '../shared/ITranslationGenerationTransport';
import { providerProtocol } from '../shared/translation-capability-key';

// The native SDK preserves image input, but its public client configuration
// supports JSON-object output rather than provider-enforced JSON Schema.
const DEEPSEEK_MODES: readonly GenerationMode[] = ['plain-stream', 'plain-buffered'];

export class DeepSeekTranslationAdapter implements ITranslationService {
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
    const provider = createDeepSeek({ apiKey: this.credential.apiKey.value });
    const modelId = this.preferences.getModelIdFor(this.credential.provider);
    return executeTranslation(
      new AiSdkGenerationTransport(provider(modelId), undefined, DEEPSEEK_MODES),
      { providerId: this.credential.provider, modelId, protocol: providerProtocol(this.credential.provider) },
      image,
      targetLanguage,
      this.preferences.includeDescription,
      this.capabilities,
      options,
    );
  }
}
