import * as browser from 'webextension-polyfill';
import { MessageSchema } from '../../../../shared/validation/MessageSchema';
import { OverlayHandler } from '../handlers/OverlayHandler';
import { TranslationModalHandler } from '../handlers/TranslationModalHandler';
import { ToastHandler } from '../handlers/ToastHandler';
import type { ThemeManager } from '../hosts/ThemeManager';

/**
 * Validates incoming runtime messages and dispatches them to the appropriate handler.
 * Centralizes message validation and routing for the content script.
 */
export class ContentMessageRouter {
  private readonly overlayHandler: OverlayHandler;
  private readonly translationModalHandler: TranslationModalHandler;
  private readonly toastHandler: ToastHandler;

  constructor(private readonly themeManager: ThemeManager) {
    this.overlayHandler = new OverlayHandler();
    this.translationModalHandler = new TranslationModalHandler(themeManager);
    this.toastHandler = new ToastHandler(themeManager);
  }

  /**
   * Registers the onMessage listener with the browser runtime.
   */
  register(): void {
    browser.runtime.onMessage.addListener(async (message: unknown) => {
      const result = MessageSchema.safeParse(message);
      if (!result.success) {
        console.error(
          '[ContentMessageRouter] Message validation failed:',
          result.error,
        );
        return;
      }

      return this.dispatch(result.data);
    });
  }

  private dispatch(message: ReturnType<typeof MessageSchema.parse>) {
    switch (message.action) {
      case 'MOUNT_OVERLAY':
        this.overlayHandler.handle(message.payload.rawImage);
        break;

      case 'MOUNT_TRANSLATION_MODAL':
        this.translationModalHandler.handle(message.payload);
        break;

      case 'THEME_CHANGED':
        this.themeManager.setTheme(message.payload.theme);
        break;

      case 'SHOW_TOAST':
        this.toastHandler.show(message.payload);
        break;

      case 'DISMISS_TOAST':
        this.toastHandler.dismiss(message.payload.id);
        break;

      case 'PING':
        return { type: 'PONG' };

      default:
        break;
    }
  }
}
