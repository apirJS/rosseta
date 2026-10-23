import type { AppError } from '../../../../shared/errors';
import type { Result } from '../../../../shared/types/Result';
import type { Translation } from '../../../domain/translation/Translation';

export interface SaveTranslationCommand {
  translation: Translation;
}

export interface ISaveTranslationUseCase {
  execute(command: SaveTranslationCommand): Promise<Result<void, AppError>>;
}
