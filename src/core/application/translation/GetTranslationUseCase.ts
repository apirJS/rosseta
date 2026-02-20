import type { IGetTranslationUseCase } from '../../ports/inbound/translation/IGetTranslationUseCase';
import type { ITranslationStorage } from '../../ports/outbound/ITranslationStorage';
import type { Translation } from '../../domain/translation/Translation';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class GetTranslationUseCase implements IGetTranslationUseCase {
  constructor(private readonly translationStorage: ITranslationStorage) {}

  async execute(id: string): Promise<Result<Translation | null, AppError>> {
    return this.translationStorage.getById(id);
  }
}
