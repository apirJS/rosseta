import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { Credential } from '../../../core/domain/credential/Credential';
import type { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import { executeTranslation } from '../shared/ai-sdk-translation';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/v1';

export class OpenCodeTranslationAdapter implements ITranslationService {
  constructor(
    private readonly credential: Credential,
    private readonly userPreferences: UserPreferences,
  ) {}

  public async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
  ): Promise<Result<Translation, AppError>> {
    const provider = createOpenAICompatible({
      name: 'OpenCode',
      baseURL: OPENCODE_BASE_URL,
      apiKey: this.credential.apiKey.value,
    });

    const model = provider(
      this.userPreferences.getModelIdFor(this.credential.provider),
    );

    return executeTranslation(
      model,
      image,
      targetLanguage,
      'OPENCODE',
      this.userPreferences.includeDescription,
    );
  }
}
