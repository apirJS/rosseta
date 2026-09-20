import type { ITranslationService } from '../../src/core/ports/outbound/ITranslationService';
import type { EncodedImage } from '../../src/core/domain/image/EncodedImage';
import type { Language } from '../../src/core/domain/translation/Language';
import { Translation } from '../../src/core/domain/translation/Translation';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';
import { v4 as uuidv4 } from 'uuid';

export class FakeTranslationService implements ITranslationService {
  private injectedError: AppError | null = null;
  private translationValue: Translation | null = null;

  /** Make the next call fail once with the given error */
  failWith(error: AppError): void {
    this.injectedError = error;
  }

  /** Override the translation that will be returned */
  willReturn(translation: Translation): void {
    this.translationValue = translation;
  }

  async translateImage(
    _image: EncodedImage,
    _targetLanguage: Language,
  ): Promise<Result<Translation, AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }

    const translation =
      this.translationValue ??
      Translation.create(uuidv4(), [], [], 'Fake translation', new Date());

    return success(translation);
  }
}
