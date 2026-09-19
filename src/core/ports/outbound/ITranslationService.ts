import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { Language } from '../../domain/translation/Language';
import type { EncodedImage } from '../../domain/image/EncodedImage';
import type { Translation } from '../../domain/translation/Translation';
import type { ICancellationToken } from './ICancellationToken';

export interface ITranslationService {
  translateImage(
    image: EncodedImage,
    targetLanguage: Language,
    cancellationToken?: ICancellationToken,
  ): Promise<Result<Translation, AppError>>;
}
