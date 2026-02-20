import type { IDeleteTranslationUseCase } from '../../ports/inbound/translation/IDeleteTranslationUseCase';
import type { ITranslationStorage } from '../../ports/outbound/ITranslationStorage';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class DeleteTranslationUseCase implements IDeleteTranslationUseCase {
  constructor(private readonly translationStorage: ITranslationStorage) {}

  async execute(id: string): Promise<Result<void, AppError>> {
    return this.translationStorage.delete(id);
  }
}
