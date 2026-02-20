import type { IClearAllTranslationsUseCase } from '../../ports/inbound/translation/IClearAllTranslationsUseCase';
import type { ITranslationStorage } from '../../ports/outbound/ITranslationStorage';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class ClearAllTranslationsUseCase implements IClearAllTranslationsUseCase {
  constructor(private readonly translationStorage: ITranslationStorage) {}

  async execute(): Promise<Result<void, AppError>> {
    return this.translationStorage.clear();
  }
}
