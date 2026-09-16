import type { ILoadModelsUseCase } from '../../ports/inbound/models/ILoadModelsUseCase';
import type { IModelStorage, StoredModel } from '../../ports/outbound/IModelStorage';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { success, failure, type Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class LoadModelsUseCase implements ILoadModelsUseCase {
  constructor(private readonly modelStorage: IModelStorage) {}

  async execute(
    provider: string,
  ): Promise<Result<StoredModel[], AppError>> {
    const result = await this.modelStorage.getModels(provider);
    if (!result.success) return failure(result.error);

    const models = result.data.map((m) => ({ id: m.id, name: m.name }));
    ProviderRegistry.setModels(provider, models);

    return success(result.data);
  }

  async executeAll(): Promise<
    Result<Record<string, StoredModel[]>, AppError>
  > {
    const result = await this.modelStorage.getAllModels();
    if (!result.success) return failure(result.error);

    for (const [provider, models] of Object.entries(result.data)) {
      if (!ProviderRegistry.hasProvider(provider)) continue;

      ProviderRegistry.setModels(
        provider,
        models.map((m) => ({ id: m.id, name: m.name })),
      );
    }

    return success(result.data);
  }
}
