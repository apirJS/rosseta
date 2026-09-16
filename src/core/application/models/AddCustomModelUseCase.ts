import type { IAddCustomModelUseCase } from '../../ports/inbound/models/IAddCustomModelUseCase';
import type { IModelStorage, StoredModel } from '../../ports/outbound/IModelStorage';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { success, failure, type Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class AddCustomModelUseCase implements IAddCustomModelUseCase {
  constructor(private readonly modelStorage: IModelStorage) {}

  async execute(
    provider: string,
    modelId: string,
    modelName?: string,
  ): Promise<Result<StoredModel[], AppError>> {
    const existingResult = await this.modelStorage.getModels(provider);
    if (!existingResult.success) return failure(existingResult.error);

    const existing = existingResult.data;

    if (existing.some((m) => m.id === modelId)) {
      return success(existing);
    }

    const newModel: StoredModel = {
      id: modelId,
      name: modelName ?? modelId,
      source: 'manual',
    };

    const updated = [...existing, newModel];

    const saveResult = await this.modelStorage.setModels(provider, updated);
    if (!saveResult.success) return failure(saveResult.error);

    ProviderRegistry.addModel(provider, { id: newModel.id, name: newModel.name });

    return success(updated);
  }
}
