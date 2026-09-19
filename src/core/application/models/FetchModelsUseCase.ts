import type { IFetchModelsUseCase } from '../../ports/inbound/models/IFetchModelsUseCase';
import type {
  IModelStorage,
  StoredModel,
} from '../../ports/outbound/IModelStorage';
import type { IModelFetchService } from '../../ports/outbound/IModelFetchService';
import type { IUserPreferencesStorage } from '../../ports/outbound/IUserPreferencesStorage';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { success, failure, type Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { CustomProviderType } from '../../domain/provider/CustomProviderConfig';

export class FetchModelsUseCase implements IFetchModelsUseCase {
  constructor(
    private readonly modelStorage: IModelStorage,
    private readonly modelFetchService: IModelFetchService,
    private readonly preferencesStorage: IUserPreferencesStorage,
  ) {}

  async execute(
    provider: string,
    apiKey: string,
    baseURL?: string,
    headers?: Record<string, string>,
    queryParams?: Record<string, string>,
    customProviderType?: CustomProviderType,
  ): Promise<Result<StoredModel[], AppError>> {
    const fetchResult = await this.modelFetchService.fetchModels(
      provider,
      apiKey,
      baseURL,
      headers,
      queryParams,
      customProviderType,
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

    await this.repairSelectedModel(provider, merged);

    return success(merged);
  }

  private async repairSelectedModel(
    provider: string,
    models: StoredModel[],
  ): Promise<void> {
    const prefsResult = await this.preferencesStorage.get();
    if (!prefsResult.success || !prefsResult.data) return;

    const preferences = prefsResult.data;
    const selectedModels = preferences.selectedModels;

    if (models.length === 0) {
      if (!(provider in selectedModels)) return;
      const { [provider]: _removed, ...rest } = selectedModels;
      await this.preferencesStorage.set({ selectedModels: rest });
      return;
    }

    const resolved = preferences.resolveModelIdFor(provider, models);
    if (resolved === preferences.getModelIdFor(provider)) return;

    await this.preferencesStorage.set({
      selectedModels: { ...selectedModels, [provider]: resolved },
    });
  }
}
