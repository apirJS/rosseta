import type { IFetchModelsUseCase } from '../../ports/inbound/models/IFetchModelsUseCase';
import type { IModelStorage, StoredModel } from '../../ports/outbound/IModelStorage';
import type { IModelFetchService } from '../../ports/outbound/IModelFetchService';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { success, failure, type Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class FetchModelsUseCase implements IFetchModelsUseCase {
  constructor(
    private readonly modelStorage: IModelStorage,
    private readonly modelFetchService: IModelFetchService,
  ) {}

  async execute(
    provider: string,
    apiKey: string,
    baseURL?: string,
  ): Promise<Result<StoredModel[], AppError>> {
    const fetchResult = await this.modelFetchService.fetchModels(
      provider,
      apiKey,
      baseURL,
    );
    if (!fetchResult.success) return failure(fetchResult.error);

    const existingResult = await this.modelStorage.getModels(provider);
    if (!existingResult.success) return failure(existingResult.error);

    const manualModels = existingResult.data.filter(
      (m) => m.source === 'manual',
    );

    const manualIds = new Set(manualModels.map((m) => m.id));
    const merged: StoredModel[] = [
      ...fetchResult.data
        .filter((m) => !manualIds.has(m.id))
        .map((m) => ({ id: m.id, name: m.name, source: 'fetched' as const })),
      ...manualModels,
    ];

    const saveResult = await this.modelStorage.setModels(provider, merged);
    if (!saveResult.success) return failure(saveResult.error);

    ProviderRegistry.setModels(
      provider,
      merged.map((m) => ({ id: m.id, name: m.name })),
    );

    return success(merged);
  }
}
