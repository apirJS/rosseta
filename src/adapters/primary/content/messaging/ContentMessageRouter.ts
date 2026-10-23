import * as browser from 'webextension-polyfill';
import { MessageSchema } from '../../../../shared/messaging/MessageSchema';
import type { OverlayHandler } from '../capture/OverlayHandler';
import type { TranslationModalHandler } from '../translation/TranslationModalHandler';
import type { ToastHandler } from './ToastHandler';
import type { ThemeManager } from '../hosts/ThemeManager';
import { sendMessageToRuntime } from '../../../../shared/messaging/index';

export interface ContentHandlers {
  translation: Pick<
    TranslationModalHandler,
    | 'register'
    | 'runtimeSettled'
    | 'runtimeFailed'
    | 'dispose'
    | 'resetDocument'
    | 'checkDeadlines'
    | 'handle'
    | 'receive'
  >;
  toast: Pick<ToastHandler, 'show' | 'dismiss'>;
  createOverlay(
    start: (requestId: string, imageBase64: string) => Promise<void>,
  ): Pick<OverlayHandler, 'handle'>;
}

export class ContentMessageRouter {
  private readonly overlayHandler: Pick<OverlayHandler, 'handle'>;

  constructor(
    private readonly themeManager: ThemeManager,
    private readonly handlers: ContentHandlers,
  ) {
    this.overlayHandler = handlers.createOverlay((requestId, imageBase64) =>
      this.startTranslation(requestId, imageBase64),
    );
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
    const identity = this.handlers.translation.register(requestId);

    try {
      await sendMessageToRuntime({
        action: 'TRANSLATE_IMAGE',
        payload: { ...identity, imageBase64 },
      });

      this.handlers.translation.runtimeSettled(requestId);
    } catch {
      this.handlers.translation.runtimeFailed(requestId);
    }
  }

  private registerDocumentLifecycle(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener?.('pagehide', () =>
        this.handlers.translation.dispose(),
      );

      window.addEventListener?.('pageshow', (event) => {
        if (event.persisted) this.handlers.translation.resetDocument();
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.handlers.translation.checkDeadlines();
      });
    }
  }

  private dispatch(message: ReturnType<typeof MessageSchema.parse>) {
    switch (message.action) {
      case 'MOUNT_OVERLAY':
        this.overlayHandler.handle(message.payload.rawImage);

        break;

      case 'MOUNT_TRANSLATION_MODAL':
        this.handlers.translation.handle(message.payload);

        break;

      case 'TRANSLATION_EVENT':
        return this.handlers.translation.receive(message.payload);

      case 'THEME_CHANGED':
        this.themeManager.setTheme(message.payload.theme);

        break;

      case 'SHOW_TOAST':
        this.handlers.toast.show(message.payload);

        break;

      case 'DISMISS_TOAST':
        this.handlers.toast.dismiss(message.payload.id);

        break;

      case 'PING':
        return { action: 'PONG' as const };

      default:
        break;
    }
  }
}
