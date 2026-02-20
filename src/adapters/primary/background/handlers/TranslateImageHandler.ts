import { v4 as uuidv4 } from 'uuid';
import type { Container } from '../../../../shared/di/container-factory';
import { failure, type Result } from '../../../../shared/types/Result';
import { AuthError } from '../../../../shared/errors';
import { UserPreferences } from '../../../../core/domain/preferences/UserPreferences';
import { createTranslationAdapter } from '../../../secondary/TranslationAdapterFactory';
import { TranslateImageUseCase } from '../../../../core/application/translation/TranslateImageUseCase';
import { TabNotifier } from '../services/TabNotifier';
import { serializeForModal } from '../../content/handlers/TranslationModalHandler';
import { sendMessageToTab } from '../../../../shared/messaging';

/**
 * Handles the TRANSLATE_IMAGE message action.
 *
 * Orchestrates the full translation pipeline:
 * 1. Validate credentials
 * 2. Fetch user preferences
 * 3. Create provider-specific translation adapter
 * 4. Execute translation use case
 * 5. Auto-save to history
 * 6. Send result to content script for modal display
 *
 * Reports progress via toast notifications at each step.
 */
export class TranslateImageHandler {
  constructor(private readonly container: Container) {}

  async handle(
    payload: { imageBase64: string },
    senderTabId: number,
  ): Promise<Result<void, Error>> {
    const toastId = `translate-${Date.now()}`;
    const notifier = new TabNotifier(senderTabId);

    await notifier.showLoading(toastId, 'Translating...');

    // --- Credential check ---
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
      console.error('[TranslateImageHandler] User not authenticated');
      await notifier.showError(
        toastId,
        'Not Authenticated',
        'Please set your API key in the extension settings.',
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
        'Not Authenticated',
        'Please set your API key in the extension settings.',
      );
      return failure(resolveResult.error);
    }

    const activeCredential = resolveResult.data;

    // --- Preferences ---
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

    // --- Translation ---
    const translationService = createTranslationAdapter(
      activeCredential,
      preferences,
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
        translationResult.error.message,
      );
      return failure(translationResult.error);
    }

    const translation = translationResult.data;

    // --- Auto-save to history ---
    const saveResult = await this.container.saveTranslationUseCase.execute({
      translation,
    });
    if (!saveResult.success) {
      console.error(
        '[TranslateImageHandler] Failed to save translation:',
        saveResult.error,
      );
    }

    // --- Notify success & mount modal ---
    await notifier.showSuccess(toastId, 'Translation Success!');

    const modalPayload = serializeForModal(translation);
    await sendMessageToTab(senderTabId, {
      action: 'MOUNT_TRANSLATION_MODAL',
      payload: modalPayload,
    });

    return { success: true, data: undefined };
  }
}
