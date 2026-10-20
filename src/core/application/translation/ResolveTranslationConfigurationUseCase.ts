import { v4 as uuidv4 } from 'uuid';
import type {
  IResolveTranslationConfigurationUseCase,
  ResolvedTranslationConfiguration,
} from '../../ports/inbound/translation/IResolveTranslationConfigurationUseCase';
import type { IResolveActiveCredentialUseCase } from '../../ports/inbound/credentials/IResolveActiveCredentialUseCase';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import type { IUserPreferencesStorage } from '../../ports/outbound/IUserPreferencesStorage';
import type { IModelStorage } from '../../ports/outbound/IModelStorage';
import type { ICustomProviderStorage } from '../../ports/outbound/ICustomProviderStorage';
import { UserPreferences } from '../../domain/preferences/UserPreferences';
import type { AnyProvider } from '../../domain/credential/Provider';
import {
  isCustomProviderId,
  type CustomProviderConfig,
} from '../../domain/provider/CustomProviderConfig';
import {
  AuthError,
  ValidationError,
  type AppError,
} from '../../../shared/errors';
import { failure, success, type Result } from '../../../shared/types/Result';

export interface ResolveTranslationConfigurationDeps {
  credentialStorage: ICredentialStorage;
  preferencesStorage: IUserPreferencesStorage;
  modelStorage: IModelStorage;
  customProviderStorage: ICustomProviderStorage;
  resolveActiveCredential: IResolveActiveCredentialUseCase;
  createId?: () => string;
}

/** Assemble one request snapshot. Browser lifetime and provider construction belong to adapters. */
export class ResolveTranslationConfigurationUseCase implements IResolveTranslationConfigurationUseCase {
  constructor(private readonly deps: ResolveTranslationConfigurationDeps) {}

  async execute(): Promise<Result<ResolvedTranslationConfiguration, AppError>> {
    const credentials = await this.deps.credentialStorage.get();

    if (!credentials.success) return failure(credentials.error);
    if (!credentials.data) return failure(AuthError.notAuthenticated());

    const credential = await this.deps.resolveActiveCredential.execute(
      credentials.data,
    );

    if (!credential.success) return failure(credential.error);

    const preferences = await this.resolvePreferences(credential.data.provider);

    if (!preferences.success) return failure(preferences.error);

    const customProvider = await this.resolveCustomProvider(
      credential.data.provider,
    );

    if (!customProvider.success) return failure(customProvider.error);

    return success({
      credential: credential.data,
      modelId: preferences.data.getModelIdFor(credential.data.provider),
      targetLanguage: preferences.data.targetLanguage,
      includeDescription: preferences.data.includeDescription,
      customProvider: customProvider.data,
    });
  }

  private async resolvePreferences(
    provider: AnyProvider,
  ): Promise<Result<UserPreferences, AppError>> {
    const loaded = await this.deps.preferencesStorage.get();

    if (!loaded.success) return failure(loaded.error);

    const initial =
      loaded.data ??
      UserPreferences.createDefault((this.deps.createId ?? uuidv4)());

    const models = await this.deps.modelStorage.getModels(provider);
    let preferences = initial;

    // Catalog loading/repair is best-effort. A missing catalog is not evidence
    // that a saved or built-in model no longer exists remotely.
    if (models.success && models.data.length > 0) {
      const modelId = initial.resolveModelIdFor(provider, models.data);

      if (modelId !== initial.getModelIdFor(provider)) {
        preferences = initial.withSelectedModel(provider, modelId);

        const saved = await this.deps.preferencesStorage.set({
          selectedModels: preferences.selectedModels,
        });

        if (!saved.success)
          console.warn(
            '[Translation configuration] Could not retain repaired model selection',
          );
      }
    }

    return preferences.hasSelectedModel(provider)
      ? success(preferences)
      : failure(
          ValidationError.invalidInput(
            `No model selected for ${provider}. Pick one under Manage Models.`,
          ),
        );
  }

  private async resolveCustomProvider(
    provider: AnyProvider,
  ): Promise<Result<CustomProviderConfig | undefined, AppError>> {
    if (!isCustomProviderId(provider)) return success(undefined);

    const configs = await this.deps.customProviderStorage.load();

    if (!configs.success) return failure(configs.error);

    const config = configs.data.find((item) => item.id === provider);

    return config
      ? success(config)
      : failure(
          ValidationError.invalidInput(
            'Custom provider is not configured. Set it up under Custom Providers.',
          ),
        );
  }
}
