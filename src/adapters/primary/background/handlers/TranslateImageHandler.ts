import { v4 as uuidv4 } from 'uuid';
import type { Container } from '../../../../shared/di/container-factory';
import { failure, type Result } from '../../../../shared/types/Result';
import { AuthError, ValidationError } from '../../../../shared/errors';
import { UserPreferences } from '../../../../core/domain/preferences/UserPreferences';
import { isCustomProviderId } from '../../../../core/domain/provider/CustomProviderConfig';
import { createTranslationAdapter } from '../../../secondary/TranslationAdapterFactory';
import { TranslateImageUseCase } from '../../../../core/application/translation/TranslateImageUseCase';
import { TabNotifier } from '../services/TabNotifier';
import { serializeForModal } from '../../content/handlers/TranslationModalHandler';
import { sendMessageToTab } from '../../../../shared/messaging';

export class TranslateImageHandler {
  constructor(private readonly container: Container) {}

  async handle(
    payload: { imageBase64: string },
    senderTabId: number,
  ): Promise<Result<void, Error>> {
    const toastId = `translate-${Date.now()}`;
    const notifier = new TabNotifier(senderTabId);

    await notifier.showLoading(toastId, 'Translating...');

    const credentialsResult =
      await this.container.getCredentialsUseCase.execute();
    if (!credentialsResult.success) {
      console.error(
        '[TranslateImageHandler] Credential check failed:',
        credentialsResult.error,
      );
      await notifier.showError(
        toastId,
        'Authentication Failed',
        credentialsResult.error.message,
      );
      return failure(credentialsResult.error);
    }

    const credentials = credentialsResult.data;
    if (!credentials) {
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
      await notifier.showError(
        toastId,
        'Preferences Error',
        userPreferencesResult.error.message,
      );
      return failure(userPreferencesResult.error);
    }

    const preferences =
      userPreferencesResult.data ?? UserPreferences.createDefault(uuidv4());

    if (!preferences.hasSelectedModel(activeCredential.provider)) {
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
        await notifier.showError(
          toastId,
          'Configuration Error',
          configResult.error.message,
        );
        return failure(configResult.error);
      }

      customProviderConfig = configResult.data.find(
        (config) => config.id === activeCredential.provider,
      );
      if (!customProviderConfig) {
        const error = ValidationError.invalidInput(
          'Custom provider is not configured. Set it up under Custom Providers.',
        );
        await notifier.showError(toastId, 'Configuration Error', error.message);
        return failure(error);
      }
    }

    const translationService = createTranslationAdapter(
      activeCredential,
      preferences,
      customProviderConfig,
    );
    const translateImageUseCase = new TranslateImageUseCase(translationService);

    const translationResult = await translateImageUseCase.execute({
      imageBase64: payload.imageBase64,
      targetLanguageCode: preferences.targetLanguage.code,
    });

    if (!translationResult.success) {
      console.error(
        '[TranslateImageHandler] Translation failed:',
        translationResult.error,
      );
      await notifier.showError(
        toastId,
        'Translation Failed!',
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

    await notifier.showSuccess(toastId, 'Translation Success!');

    const modalPayload = serializeForModal(translation);
    await sendMessageToTab(senderTabId, {
      action: 'MOUNT_TRANSLATION_MODAL',
      payload: modalPayload,
    });

    return { success: true, data: undefined };
  }
}
