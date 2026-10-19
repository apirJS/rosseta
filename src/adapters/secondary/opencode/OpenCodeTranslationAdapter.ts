import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { v4 as uuidv4 } from 'uuid';
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
const OPENCODE_BASE_URL = 'https://opencode.ai/zen/v1';
const OPENCODE_USER_AGENT = 'opencode/0.20.5';
const OPENCODE_SESSION_ID = uuidv4();
export class OpenCodeTranslationAdapter implements ITranslationService {
    constructor(private readonly credential: Credential, private readonly userPreferences: UserPreferences, private readonly capabilities: ITranslationCapabilityStorage) { }
    public async translateImage(image: EncodedImage, targetLanguage: Language, options?: TranslationExecutionOptions): Promise<Result<Translation, AppError>> {
        const provider = createOpenAICompatible({
            name: 'OpenCode',
            baseURL: OPENCODE_BASE_URL,
            apiKey: this.credential.apiKey.value,
            supportsStructuredOutputs: true,
            headers: {
                'X-Session-ID': OPENCODE_SESSION_ID,
                'User-Agent': OPENCODE_USER_AGENT,
                'HTTP-Referer': 'https://opencode.ai/',
                'X-Title': 'opencode',
            },
        });
        const model = provider(this.userPreferences.getModelIdFor(this.credential.provider));
        return executeTranslation(new AiSdkGenerationTransport(model), { providerId: this.credential.provider, modelId: this.userPreferences.getModelIdFor(this.credential.provider), protocol: providerProtocol(this.credential.provider), legacyUnambiguous: true }, image, targetLanguage, this.userPreferences.includeDescription, this.capabilities, options);
    }
}
