import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import type { ITranslationCapabilityStorage } from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import type { TranslationExecutionOptions } from '../../../core/ports/outbound/TranslationExecutionOptions';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Language } from '../../../core/domain/translation/Language';
import type { ProviderRuntime } from './transports/GenerationTransport';
import { executeTranslation } from './execute-translation';

/** Bind one resolved request snapshot to the common generation engine. */
export class TranslationServiceAdapter implements ITranslationService {
  constructor(
    private readonly createRuntime: () => ProviderRuntime,
    private readonly includeDescription: boolean,
    private readonly capabilities: ITranslationCapabilityStorage,
  ) {}

  async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
    options?: TranslationExecutionOptions,
  ) {
    const { transport, context } = this.createRuntime();

    return executeTranslation(
      transport,
      context,
      image,
      targetLanguage,
      this.includeDescription,
      this.capabilities,
      options,
    );
  }
}
