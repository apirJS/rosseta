import type { IRefreshProviderModelsUseCase } from '../../ports/inbound/providers/IRefreshProviderModelsUseCase';
import type {
  IModelStorage,
  StoredModel,
} from '../../ports/outbound/IModelStorage';
import type {
  IModelFetchService,
  ModelInfo,
} from '../../ports/outbound/IModelFetchService';
import type { IUserPreferencesStorage } from '../../ports/outbound/IUserPreferencesStorage';
import type { ICustomProviderStorage } from '../../ports/outbound/ICustomProviderStorage';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import type { ITranslationCapabilityStorage } from '../../ports/outbound/ITranslationCapabilityStorage';
import type { IProviderMutationLock } from '../../ports/outbound/IProviderMutationLock';
import { isProvider } from '../../domain/credential/Provider';
import {
  isCustomProviderId,
  type CustomProviderConfig,
} from '../../domain/provider/CustomProviderConfig';
import { success, failure, type Result } from '../../../shared/types/Result';
import { AppError, AuthError, ValidationError } from '../../../shared/errors';

export interface RefreshProviderModelsDeps {
  modelStorage: IModelStorage;
  modelFetchService: IModelFetchService;
  preferencesStorage: IUserPreferencesStorage;
  customProviderStorage: ICustomProviderStorage;
  credentialStorage: ICredentialStorage;
  capabilityStorage: ITranslationCapabilityStorage;
  mutationLock: IProviderMutationLock;
}

/** Refresh one catalog and its compatibility window; no browser or SDK details. */
export class RefreshProviderModelsUseCase implements IRefreshProviderModelsUseCase {
  constructor(private readonly deps: RefreshProviderModelsDeps) {}

  async execute(provider: string): Promise<Result<StoredModel[], AppError>> {
    const config = await this.resolveConfig(provider);

    if (!config.success) return failure(config.error);

    const apiKey = await this.resolveApiKey(provider);

    if (!apiKey.success) return failure(apiKey.error);

    const fetched = await this.deps.modelFetchService.fetchModels(
      provider,
      apiKey.data,
      config.data?.baseURL,
      config.data?.headers,
      config.data?.queryParams,
      config.data?.type,
    );

    if (!fetched.success) return failure(fetched.error);

    // Network latency never holds the lock. Recheck existence only after
    // acquiring the same provider boundary used by staged deletion.
    return this.deps.mutationLock.run(provider, () =>
      this.commitCatalog(provider, fetched.data),
    );
  }

  private async commitCatalog(
    provider: string,
    models: ModelInfo[],
  ): Promise<Result<StoredModel[], AppError>> {
    const current = await this.ensureProviderStillExists(provider);

    if (!current.success) return failure(current.error);

    const saved = await this.persistCatalog(provider, models);

    if (!saved.success) return failure(saved.error);

    await this.reconcileSelection(provider, saved.data);

    const reset = await this.deps.capabilityStorage.resetNamespace(provider);

    if (!reset.success) {
      const userMessage =
        'Models were updated, but compatibility could not be reset. Try fetching models again.';

      return failure(
        new AppError({
          code: reset.error.code,
          message: userMessage,
          userMessage,
        }),
      );
    }

    return success(saved.data);
  }

  private async persistCatalog(
    provider: string,
    fetched: ModelInfo[],
  ): Promise<Result<StoredModel[], AppError>> {
    const existing = await this.deps.modelStorage.getModels(provider);

    if (!existing.success) return failure(existing.error);

    const manual = existing.data.filter((model) => model.source === 'manual');
    const manualIds = new Set(manual.map((model) => model.id));

    const models: StoredModel[] = [
      ...fetched
        .filter((model) => !manualIds.has(model.id))
        .map((model) => ({
          id: model.id,
          name: model.name,
          source: 'fetched' as const,
        })),
      ...manual,
    ];

    const saved = await this.deps.modelStorage.setModels(provider, models);

    return saved.success ? success(models) : failure(saved.error);
  }

  private async ensureProviderStillExists(
    provider: string,
  ): Promise<Result<void, AppError>> {
    if (!isCustomProviderId(provider)) return success(undefined);

    const result = await this.deps.customProviderStorage.load();

    if (!result.success) return failure(result.error);

    return result.data.some((config) => config.id === provider)
      ? success(undefined)
      : failure(
          ValidationError.invalidInput(
            'This custom provider was removed. Its model list was not saved.',
            { provider },
          ),
        );
  }

  private async resolveConfig(
    provider: string,
  ): Promise<Result<CustomProviderConfig | undefined, AppError>> {
    if (isProvider(provider)) return success(undefined);
    if (!isCustomProviderId(provider))
      return failure(
        ValidationError.invalidInput(`Unknown provider: ${provider}`),
      );

    const result = await this.deps.customProviderStorage.load();

    if (!result.success) return failure(result.error);

    const config = result.data.find((candidate) => candidate.id === provider);

    return config
      ? success(config)
      : failure(ValidationError.invalidInput(`Unknown provider: ${provider}`));
  }

  private async resolveApiKey(
    provider: string,
  ): Promise<Result<string, AppError>> {
    const result = await this.deps.credentialStorage.get();

    if (!result.success) return failure(result.error);

    const active = result.data?.getActive();

    const credential =
      active?.provider === provider
        ? active
        : result.data?.getByProvider(provider)[0];

    return credential
      ? success(credential.apiKey.value)
      : failure(
          new AuthError({
            message: 'No API key available for this provider. Add a key first.',
            userMessage:
              'No API key is configured for this provider. Add a key first.',
            context: { provider },
          }),
        );
  }

  private async reconcileSelection(
    provider: string,
    models: StoredModel[],
  ): Promise<void> {
    const result = await this.deps.preferencesStorage.get();

    if (!result.success || !result.data) return;

    const preferences = result.data;

    if (models.length === 0) {
      if (!(provider in preferences.selectedModels)) return;

      const { [provider]: _removed, ...selectedModels } =
        preferences.selectedModels;

      await this.deps.preferencesStorage.set({ selectedModels });

      return;
    }

    const modelId = preferences.resolveModelIdFor(provider, models);

    if (modelId !== preferences.getModelIdFor(provider)) {
      await this.deps.preferencesStorage.set({
        selectedModels: { ...preferences.selectedModels, [provider]: modelId },
      });
    }
  }
}
