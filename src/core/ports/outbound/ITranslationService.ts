import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { Language } from '../../domain/translation/Language';
import type { EncodedImage } from '../../domain/image/EncodedImage';
import type { Translation } from '../../domain/translation/Translation';
import type { TranslationExecutionOptions } from './TranslationExecutionOptions';

export interface ITranslationService {
  translateImage(
    image: EncodedImage,
    targetLanguage: Language,
    options?: TranslationExecutionOptions,
  ): Promise<Result<Translation, AppError>>;
}
