import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { Translation } from '../../../domain/translation/Translation';
import type { TranslationExecutionOptions } from '../../outbound/TranslationExecutionOptions';

export interface TranslateImageCommand extends TranslationExecutionOptions {
  imageBase64: string;
  targetLanguageCode: string;
}

export interface ITranslateImageUseCase {
  execute(
    command: TranslateImageCommand,
  ): Promise<Result<Translation, AppError>>;
}
