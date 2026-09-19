import { v4 as uuidv4 } from 'uuid';
import type { Container } from '../../../../shared/di/container-factory';
import { failure, type Result } from '../../../../shared/types/Result';
import {
  AuthError,
  ERROR_TITLES,
  ValidationError,
} from '../../../../shared/errors';
import { UserPreferences } from '../../../../core/domain/preferences/UserPreferences';
import type { StoredModel } from '../../../../core/ports/outbound/IModelStorage';
import { isCustomProviderId } from '../../../../core/domain/provider/CustomProviderConfig';
import { createTranslationAdapter } from '../../../secondary/TranslationAdapterFactory';
import { TranslateImageUseCase } from '../../../../core/application/translation/TranslateImageUseCase';
import { TabNotifier } from '../services/TabNotifier';
import { serializeForModal } from '../../content/handlers/TranslationModalHandler';
import { sendMessageToTab } from '../../../../shared/messaging';
import { AbortCancellationToken } from '../services/AbortCancellationToken';
import type { ICancellationToken } from '../../../../core/ports/outbound/ICancellationToken';

export class TranslateImageHandler {
  private readonly activeTranslations = new Map<string, AbortCancellationToken>();

  constructor(private readonly container: Container) {}

  async handle(
    payload: { imageBase64: string },
    senderTabId: number,
  ): Promise<Result<void, Error>> {
    const toastId = `translate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const cancellationToken = new AbortCancellationToken();
    this.activeTranslations.set(toastId, cancellationToken);

    try {
      return await this.process(
        payload,
        senderTabId,
        toastId,
        cancellationToken,
      );
    } finally {
      this.activeTranslations.delete(toastId);
    }
  }

  cancel(toastId: string): void {
    this.activeTranslations.get(toastId)?.cancel();
  }

  private async process(
    payload: { imageBase64: string },
    senderTabId: number,
    toastId: string,
    cancellationToken: ICancellationToken,
  ): Promise<Result<void, Error>> {
    const notifier = new TabNotifier(senderTabId);

    await notifier.showLoading(toastId, 'Translating...');

    const credentialsResult =
      await this.container.getCredentialsUseCase.execute();
    if (!credentialsResult.success) {
      if (cancellationToken.isCancellationRequested) return failure(new Error('Translation cancelled'));
      console.error(
        '[TranslateImageHandler] Credential check failed:',
        credentialsResult.error,
      );
      await notifier.showError(
        toastId,
        'Authentication Failed',
        credentialsResult.error.userMessage,
      );
      return failure(credentialsResult.error);
    }

    const credentials = credentialsResult.data;
    if (!credentials) {
      if (cancellationToken.isCancellationRequested) return failure(new Error('Translation cancelled'));
      console.error('[TranslateImageHandler] No credentials stored');
      await notifier.showError(
        toastId,
        'No API Key',
        'Add an API key in the extension popup.',
      );
      return failure(AuthError.notAuthenticated());
    }

    const resolveResult =
      await this.container.resolveActiveCredentialUseCase.execute(credentials);
    if (!resolveResult.success) {
      if (cancellationToken.isCancellationRequested) return failure(new Error('Translation cancelled'));
      console.error(
        '[TranslateImageHandler] Credential resolution failed:',
        resolveResult.error,
      );
      await notifier.showError(
        toastId,
        'No API Key',
        'Add an API key in the extension popup.',
      );
      return failure(resolveResult.error);
    }

    const activeCredential = resolveResult.data;

    const userPreferencesResult =
      await this.container.getPreferencesUseCase.execute();
    if (!userPreferencesResult.success) {
      if (cancellationToken.isCancellationRequested) return failure(new Error('Translation cancelled'));
      await notifier.showError(
        toastId,
        'Preferences Error',
        userPreferencesResult.error.userMessage,
      );
      return failure(userPreferencesResult.error);
    }

    let preferences =
      userPreferencesResult.data ?? UserPreferences.createDefault(uuidv4());

    const modelsResult = await this.container.loadModelsUseCase.execute(
      activeCredential.provider,
    );
    if (modelsResult.success) {
      preferences = await this.repairStaleModelSelection(
        preferences,
        activeCredential.provider,
        modelsResult.data,
      );
    } else {
      console.warn(
        '[TranslateImageHandler] Could not load stored models, skipping model validation:',
        modelsResult.error,
      );
    }

    if (!preferences.hasSelectedModel(activeCredential.provider)) {
      if (cancellationToken.isCancellationRequested) return failure(new Error('Translation cancelled'));
      const error = ValidationError.invalidInput(
        `No model selected for ${activeCredential.provider}. Pick one under Manage Models.`,
      );
      await notifier.showError(toastId, 'No Model Selected', error.message);
      return failure(error);
    }

    let customProviderConfig;
    if (isCustomProviderId(activeCredential.provider)) {
      const configResult =
        await this.container.getCustomProvidersUseCase.execute();
      if (!configResult.success) {
        if (cancellationToken.isCancellationRequested) return failure(new Error('Translation cancelled'));
        await notifier.showError(
          toastId,
          'Configuration Error',
          configResult.error.userMessage,
        );
        return failure(configResult.error);
      }

      customProviderConfig = configResult.data.find(
        (config) => config.id === activeCredential.provider,
      );
      if (!customProviderConfig) {
        if (cancellationToken.isCancellationRequested) return failure(new Error('Translation cancelled'));
        const error = ValidationError.invalidInput(
          'Custom provider is not configured. Set it up under Custom Providers.',
        );
        await notifier.showError(toastId, 'Configuration Error', error.userMessage);
        return failure(error);
      }
    }

    const translationService = createTranslationAdapter(
      activeCredential,
      preferences,
      customProviderConfig,
      this.container.structuredOutputExemptionStorage,
    );
    const translateImageUseCase = new TranslateImageUseCase(translationService);

    const translationResult = await translateImageUseCase.execute({
      imageBase64: payload.imageBase64,
      targetLanguageCode: preferences.targetLanguage.code,
      cancellationToken,
    });

    if (cancellationToken.isCancellationRequested) {
      return failure(new Error('Translation cancelled'));
    }

    if (!translationResult.success) {
      console.error(
        '[TranslateImageHandler] Translation failed:',
        translationResult.error,
      );
      await notifier.showError(
        toastId,
        ERROR_TITLES[translationResult.error.code],
        translationResult.error.userMessage,
      );
      return failure(translationResult.error);
    }

    const translation = translationResult.data;

    const saveResult = await this.container.saveTranslationUseCase.execute({
      translation,
    });
    if (!saveResult.success) {
      console.error(
        '[TranslateImageHandler] Failed to save translation:',
        saveResult.error,
      );
    }

    if (cancellationToken.isCancellationRequested) {
      return failure(new Error('Translation cancelled'));
    }

    await notifier.showSuccess(toastId, 'Translation Success!');

    const modalPayload = serializeForModal(translation);
    await sendMessageToTab(senderTabId, {
      action: 'MOUNT_TRANSLATION_MODAL',
      payload: modalPayload,
    });

    return { success: true, data: undefined };
  }

  /**
   * Falls back to the registry default or first stored model when the
   * saved selection is no longer in the stored model list, and persists
   * the repair. Best-effort: a persist failure keeps the in-memory repair.
   */
  private async repairStaleModelSelection(
    preferences: UserPreferences,
    provider: string,
    models: StoredModel[],
  ): Promise<UserPreferences> {
    if (models.length === 0) return preferences;

    const resolved = preferences.resolveModelIdFor(provider, models);
    if (resolved === preferences.getModelIdFor(provider)) return preferences;

    const repaired = preferences.withSelectedModel(provider, resolved);
    const updateResult = await this.container.updatePreferencesUseCase.execute(
      { preferences: { selectedModels: repaired.selectedModels } },
    );
    if (!updateResult.success) {
      console.warn(
        '[TranslateImageHandler] Could not persist repaired model selection:',
        updateResult.error,
      );
    }
    return repaired;
  }
}
