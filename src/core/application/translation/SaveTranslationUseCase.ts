import type {
  ISaveTranslationUseCase,
  SaveTranslationCommand,
} from '../../ports/inbound/translation/ISaveTranslationUseCase';
import type { ITranslationStorage } from '../../ports/outbound/ITranslationStorage';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class SaveTranslationUseCase implements ISaveTranslationUseCase {
  constructor(private readonly translationStorage: ITranslationStorage) {}

  async execute(command: SaveTranslationCommand): Promise<Result<void, AppError>> {
    return this.translationStorage.save(command.translation);
  }
}
