import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { Translation } from '../../../domain/translation/Translation';

export interface TranslateImageCommand {
  imageBase64: string;
  targetLanguageCode: string;
}

export interface ITranslateImageUseCase {
  execute(
    command: TranslateImageCommand,
  ): Promise<Result<Translation, AppError>>;
}
