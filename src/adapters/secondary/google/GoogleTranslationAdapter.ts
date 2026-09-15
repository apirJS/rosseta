import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { Credential } from '../../../core/domain/credential/Credential';
import type { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import { executeTranslation } from '../shared/ai-sdk-translation';

export class GoogleTranslationAdapter implements ITranslationService {
  constructor(
    private readonly credential: Credential,
    private readonly userPreferences: UserPreferences,
  ) {}

  public async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
  ): Promise<Result<Translation, AppError>> {
    const google = createGoogleGenerativeAI({
      apiKey: this.credential.apiKey.value,
    });

    const model = google(
      this.userPreferences.getModelIdFor(this.credential.provider),
    );

    return executeTranslation(model, image, targetLanguage, 'GOOGLE');
  }
}
