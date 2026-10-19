import * as browser from 'webextension-polyfill';
import { MessageSchema } from '../../../../shared/validation/MessageSchema';
import { OverlayHandler } from '../handlers/OverlayHandler';
import { TranslationModalHandler } from '../handlers/TranslationModalHandler';
import { ToastHandler } from '../handlers/ToastHandler';
import type { ThemeManager } from '../hosts/ThemeManager';
import { sendMessageToRuntime } from '../../../../shared/messaging';

export class ContentMessageRouter {
  private readonly overlayHandler: OverlayHandler;
  private readonly translationModalHandler: TranslationModalHandler;
  private readonly toastHandler: ToastHandler;

  constructor(private readonly themeManager: ThemeManager) {
    this.translationModalHandler = new TranslationModalHandler(themeManager);
    this.overlayHandler = new OverlayHandler((requestId, imageBase64) =>
      this.startTranslation(requestId, imageBase64),
    );
    this.toastHandler = new ToastHandler(themeManager);
  }

  register(): void {
    this.registerDocumentLifecycle();
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

  private async startTranslation(
    requestId: string,
    imageBase64: string,
  ): Promise<void> {
    const identity = this.translationModalHandler.register(requestId);
    try {
      await sendMessageToRuntime({
        action: 'TRANSLATE_IMAGE',
        payload: { ...identity, imageBase64 },
      });
      this.translationModalHandler.runtimeSettled(requestId);
    } catch {
      this.translationModalHandler.runtimeFailed(requestId);
    }
  }

  private registerDocumentLifecycle(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener?.('pagehide', () =>
        this.translationModalHandler.dispose(),
      );
      window.addEventListener?.('pageshow', (event) => {
        if (event.persisted) this.translationModalHandler.resetDocument();
      });
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.translationModalHandler.checkDeadlines();
      });
    }
  }

  private dispatch(message: ReturnType<typeof MessageSchema.parse>) {
    switch (message.action) {
      case 'MOUNT_OVERLAY':
        this.overlayHandler.handle(message.payload.rawImage);
        break;

      case 'MOUNT_TRANSLATION_MODAL':
        this.translationModalHandler.handle(message.payload);
        break;

      case 'TRANSLATION_EVENT':
        return this.translationModalHandler.receive(message.payload);

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
        return { action: 'PONG' as const };

      default:
        break;
    }
  }
}
