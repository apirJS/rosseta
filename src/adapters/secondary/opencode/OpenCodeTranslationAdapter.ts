import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { v4 as uuidv4 } from 'uuid';
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

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/v1';
const OPENCODE_USER_AGENT = 'opencode/0.20.5';

const OPENCODE_SESSION_ID = uuidv4();

export class OpenCodeTranslationAdapter implements ITranslationService {
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
    const provider = createOpenAICompatible({
      name: 'OpenCode',
      baseURL: OPENCODE_BASE_URL,
      apiKey: this.credential.apiKey.value,
      headers: {
        'X-Session-ID': OPENCODE_SESSION_ID,
        'User-Agent': OPENCODE_USER_AGENT,
        'HTTP-Referer': 'https://opencode.ai/',
        'X-Title': 'opencode',
      },
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
      this.structuredOutputExemptions,
      cancellationToken,
    );
  }
}
