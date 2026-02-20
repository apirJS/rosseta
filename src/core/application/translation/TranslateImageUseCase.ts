import type {
  ITranslateImageUseCase,
  TranslateImageCommand,
} from '../../ports/inbound/translation/ITranslateImageUseCase';
import type { ITranslationService } from '../../ports/outbound/ITranslationService';
import type { Translation } from '../../domain/translation/Translation';
import { Language } from '../../domain/translation/Language';
import { EncodedImage } from '../../domain/image/EncodedImage';
import { failure, type Result } from '../../../shared/types/Result';
import { TranslationError, type AppError } from '../../../shared/errors';

export class TranslateImageUseCase implements ITranslateImageUseCase {
  constructor(private readonly translationService: ITranslationService) {}

  async execute(
    command: TranslateImageCommand,
  ): Promise<Result<Translation, AppError>> {
    const targetLangResult = Language.fromRaw(command.targetLanguageCode);
    if (!targetLangResult.success) {
      return failure(
        TranslationError.unsupportedLanguage(command.targetLanguageCode),
      );
    }

    const imageResult = EncodedImage.create(command.imageBase64);
    if (!imageResult.success) {
      return failure(TranslationError.invalidImage());
    }

    return await this.translationService.translateImage(
      imageResult.data,
      targetLangResult.data,
    );
  }
}
