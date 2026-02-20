import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { Language } from '../../domain/translation/Language';
import type { EncodedImage } from '../../domain/image/EncodedImage';
import type { Translation } from '../../domain/translation/Translation';

export interface ITranslationService {
  translateImage(
    image: EncodedImage,
    targetLanguage: Language,
  ): Promise<Result<Translation, AppError>>;
}
