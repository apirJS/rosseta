import type { IClearModelsUseCase } from '../../ports/inbound/models/IClearModelsUseCase';
import type { IModelStorage } from '../../ports/outbound/IModelStorage';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { success, failure, type Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class ClearModelsUseCase implements IClearModelsUseCase {
  constructor(private readonly modelStorage: IModelStorage) {}

  async execute(provider: string): Promise<Result<void, AppError>> {
    const result = await this.modelStorage.clearModels(provider);
    if (!result.success) return failure(result.error);

    ProviderRegistry.setModels(provider, []);

    return success(undefined);
  }
}
