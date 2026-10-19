import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import type { TranslationExecutionOptions } from '../../../core/ports/outbound/TranslationExecutionOptions';
import type { ITranslationCapabilityStorage } from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import type { Credential } from '../../../core/domain/credential/Credential';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import type { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import { executeTranslation } from '../shared/ai-sdk-translation';
import { PuterGenerationTransport } from './PuterGenerationTransport';
export class PuterTranslationAdapter implements ITranslationService {
  constructor(
    private readonly credential: Credential,
    private readonly userPreferences: UserPreferences,
    private readonly capabilities: ITranslationCapabilityStorage,
  ) {}
  async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
    options?: TranslationExecutionOptions,
  ): Promise<Result<Translation, AppError>> {
    const modelId = this.userPreferences.getModelIdFor('puter');
    return executeTranslation(
      new PuterGenerationTransport(this.credential.apiKey.value, modelId),
      { providerId: 'puter', modelId, protocol: 'puter-native' },
      image,
      targetLanguage,
      this.userPreferences.includeDescription,
      this.capabilities,
      options,
    );
  }
}
