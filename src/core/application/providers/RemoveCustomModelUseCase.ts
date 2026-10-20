import type { IRemoveCustomModelUseCase } from '../../ports/inbound/providers/IRemoveCustomModelUseCase';
import type {
  IModelStorage,
  StoredModel,
} from '../../ports/outbound/IModelStorage';
import { success, failure, type Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class RemoveCustomModelUseCase implements IRemoveCustomModelUseCase {
  constructor(private readonly modelStorage: IModelStorage) {}

  async execute(
    provider: string,
    modelId: string,
  ): Promise<Result<StoredModel[], AppError>> {
    const existingResult = await this.modelStorage.getModels(provider);

    if (!existingResult.success) return failure(existingResult.error);

    const updated = existingResult.data.filter((m) => m.id !== modelId);

    const saveResult = await this.modelStorage.setModels(provider, updated);

    if (!saveResult.success) return failure(saveResult.error);

    return success(updated);
  }
}
