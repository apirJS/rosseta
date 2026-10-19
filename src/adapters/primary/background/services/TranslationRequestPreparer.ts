import { v4 as uuidv4 } from 'uuid';
import type { Credential } from '../../../../core/domain/credential/Credential';
import type { AnyProvider } from '../../../../core/domain/credential/Provider';
import { UserPreferences } from '../../../../core/domain/preferences/UserPreferences';
import {
  isCustomProviderId,
  type CustomProviderConfig,
} from '../../../../core/domain/provider/CustomProviderConfig';
import { TranslateImageUseCase } from '../../../../core/application/translation/TranslateImageUseCase';
import type { ITranslateImageUseCase } from '../../../../core/ports/inbound/translation/ITranslateImageUseCase';
import type { Container } from '../../../../shared/di/container-factory';
import {
  AuthError,
  ValidationError,
  type AppError,
} from '../../../../shared/errors';
import { failure, success, type Result } from '../../../../shared/types/Result';
import { createTranslationAdapter } from '../../../secondary/TranslationAdapterFactory';

export interface PreparedTranslationRequest {
  useCase: ITranslateImageUseCase;
  targetLanguage: { code: string; name: string };
}

export interface ITranslationRequestPreparer {
  prepare(): Promise<Result<PreparedTranslationRequest, AppError>>;
}

/** Compose existing configuration actions; generation and history remain separate actions. */
export class TranslationRequestPreparer implements ITranslationRequestPreparer {
  constructor(private readonly container: Container) {}

  async prepare(): Promise<Result<PreparedTranslationRequest, AppError>> {
    const credential = await this.resolveCredential();
    if (!credential.success) return credential;

    const preferences = await this.resolvePreferences(credential.data.provider);
    if (!preferences.success) return preferences;

    const config = await this.resolveCustomProvider(credential.data.provider);
    if (!config.success) return config;

    const service = createTranslationAdapter(
      credential.data,
      preferences.data,
      config.data,
      this.container.translationCapabilityStorage,
    );
    return success({
      useCase: new TranslateImageUseCase(service),
      targetLanguage: {
        code: preferences.data.targetLanguage.code,
        name: preferences.data.targetLanguage.name,
      },
    });
  }

  private async resolveCredential(): Promise<Result<Credential, AppError>> {
    const credentials = await this.container.getCredentialsUseCase.execute();
    if (!credentials.success) return failure(credentials.error);
    if (!credentials.data) return failure(AuthError.notAuthenticated());

    return this.container.resolveActiveCredentialUseCase.execute(
      credentials.data,
    );
  }

  private async resolvePreferences(
    provider: AnyProvider,
  ): Promise<Result<UserPreferences, AppError>> {
    const loadedPreferences =
      await this.container.getPreferencesUseCase.execute();
    if (!loadedPreferences.success) return failure(loadedPreferences.error);

    const initial =
      loadedPreferences.data ?? UserPreferences.createDefault(uuidv4());
    const preferences = await this.repairSelectedModel(provider, initial);
    if (!preferences.hasSelectedModel(provider)) {
      return failure(
        ValidationError.invalidInput(
          `No model selected for ${provider}. Pick one under Manage Models.`,
        ),
      );
    }
    return success(preferences);
  }

  private async repairSelectedModel(
    provider: AnyProvider,
    preferences: UserPreferences,
  ): Promise<UserPreferences> {
    const models = await this.container.loadModelsUseCase.execute(provider);
    if (!models.success || models.data.length === 0) return preferences;

    const modelId = preferences.resolveModelIdFor(provider, models.data);
    if (modelId === preferences.getModelIdFor(provider)) return preferences;

    const repaired = preferences.withSelectedModel(provider, modelId);
    const persisted = await this.container.updatePreferencesUseCase.execute({
      preferences: { selectedModels: repaired.selectedModels },
    });

    if (!persisted.success) {
      console.warn(
        '[TranslationRequestPreparer] Could not retain repaired model selection',
      );
    }

    return repaired;
  }

  private async resolveCustomProvider(
    provider: AnyProvider,
  ): Promise<Result<CustomProviderConfig | undefined, AppError>> {
    if (!isCustomProviderId(provider)) return success(undefined);

    const configs = await this.container.getCustomProvidersUseCase.execute();
    if (!configs.success) return failure(configs.error);

    const config = configs.data.find((item) => item.id === provider);
    if (!config) {
      return failure(
        ValidationError.invalidInput(
          'Custom provider is not configured. Set it up under Custom Providers.',
        ),
      );
    }

    return success(config);
  }
}
