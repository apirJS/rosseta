import { createAnthropic } from '@ai-sdk/anthropic';
import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import type { TranslationExecutionOptions } from '../../../core/ports/outbound/TranslationExecutionOptions';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { Credential } from '../../../core/domain/credential/Credential';
import type { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import type { ITranslationCapabilityStorage } from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import { executeTranslation } from '../shared/ai-sdk-translation';
import { AiSdkGenerationTransport } from '../shared/AiSdkGenerationTransport';
import { providerProtocol } from '../shared/translation-capability-key';
export class AnthropicTranslationAdapter implements ITranslationService {
    constructor(private readonly credential: Credential, private readonly userPreferences: UserPreferences, private readonly capabilities: ITranslationCapabilityStorage) { }
    public async translateImage(image: EncodedImage, targetLanguage: Language, options?: TranslationExecutionOptions): Promise<Result<Translation, AppError>> {
        const anthropic = createAnthropic({
            apiKey: this.credential.apiKey.value,
        });
        const model = anthropic(this.userPreferences.getModelIdFor(this.credential.provider));
        return executeTranslation(new AiSdkGenerationTransport(model, { anthropic: { structuredOutputMode: 'outputFormat' } }), { providerId: this.credential.provider, modelId: this.userPreferences.getModelIdFor(this.credential.provider), protocol: providerProtocol(this.credential.provider), legacyUnambiguous: true }, image, targetLanguage, this.userPreferences.includeDescription, this.capabilities, options);
    }
}
