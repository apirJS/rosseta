import type { IGetAllTranslationsUseCase } from '../../ports/inbound/translation/IGetAllTranslationsUseCase';
import type { ITranslationStorage } from '../../ports/outbound/ITranslationStorage';
import type { Translation } from '../../domain/translation/Translation';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class GetAllTranslationsUseCase implements IGetAllTranslationsUseCase {
  constructor(private readonly translationStorage: ITranslationStorage) {}

  async execute(): Promise<Result<Translation[], AppError>> {
    return this.translationStorage.getAll();
  }
}
