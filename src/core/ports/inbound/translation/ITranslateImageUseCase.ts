import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';
import type { Translation } from '../../../domain/translation/Translation';
import type { ICancellationToken } from '../../outbound/ICancellationToken';

export interface TranslateImageCommand {
  imageBase64: string;
  targetLanguageCode: string;
  cancellationToken?: ICancellationToken;
}

export interface ITranslateImageUseCase {
  execute(
    command: TranslateImageCommand,
  ): Promise<Result<Translation, AppError>>;
}
