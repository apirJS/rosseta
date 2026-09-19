import { createXai } from '@ai-sdk/xai';
import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import type { ICancellationToken } from '../../../core/ports/outbound/ICancellationToken';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { Credential } from '../../../core/domain/credential/Credential';
import type { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import type { IStructuredOutputExemptionStorage } from '../../../core/ports/outbound/IStructuredOutputExemptionStorage';
import { executeTranslation } from '../shared/ai-sdk-translation';

export class XaiTranslationAdapter implements ITranslationService {
  constructor(
    private readonly credential: Credential,
    private readonly userPreferences: UserPreferences,
    private readonly structuredOutputExemptions: IStructuredOutputExemptionStorage,
  ) {}

  public async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
    cancellationToken?: ICancellationToken,
  ): Promise<Result<Translation, AppError>> {
    const xai = createXai({
      apiKey: this.credential.apiKey.value,
    });

    const model = xai(
      this.userPreferences.getModelIdFor(this.credential.provider),
    );

    return executeTranslation(model, image, targetLanguage, 'XAI', this.userPreferences.includeDescription, this.structuredOutputExemptions, cancellationToken);
  }
}
