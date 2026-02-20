import * as browser from 'webextension-polyfill';
import { MessageSchema } from '../../../shared/validation/MessageSchema';
import { TranslateImageHandler } from './handlers/TranslateImageHandler';
import { StartOverlayHandler } from './handlers/StartOverlayHandler';
import { MountHistoryModalHandler } from './handlers/MountHistoryModalHandler';
import { OverlayService } from './services/OverlayService';
import { BrowserError } from '../../../shared/errors';
import { failure } from '../../../shared/types/Result';
import type { Container } from '../../../shared/di/container-factory';

/**
 * Validates incoming runtime messages and dispatches them to the appropriate handler.
 * Centralizes message validation and routing for the service worker.
 */
export class MessageRouter {
  private readonly translateImageHandler: TranslateImageHandler;
  private readonly startOverlayHandler: StartOverlayHandler;
  private readonly mountHistoryModalHandler: MountHistoryModalHandler;

  constructor(container: Container) {
    const overlayService = new OverlayService(container);

    this.translateImageHandler = new TranslateImageHandler(container);
    this.startOverlayHandler = new StartOverlayHandler(overlayService);
    this.mountHistoryModalHandler = new MountHistoryModalHandler();
  }

  /**
   * Registers the onMessage listener with the browser runtime.
   */
  register(): void {
    browser.runtime.onMessage.addListener(
      async (message: unknown, sender: browser.Runtime.MessageSender) => {
        const parsedMessage = MessageSchema.safeParse(message);
        if (!parsedMessage.success) {
          console.error(
            '[MessageRouter] Message validation failed:',
            parsedMessage.error,
          );
          return;
        }

        return this.dispatch(parsedMessage.data, sender);
      },
    );
  }

  private async dispatch(
    message: ReturnType<typeof MessageSchema.parse>,
    sender: browser.Runtime.MessageSender,
  ) {
    switch (message.action) {
      case 'TRANSLATE_IMAGE': {
        const senderTabId = sender.tab?.id;
        if (!senderTabId) {
          console.error('[MessageRouter] No sender tab for TRANSLATE_IMAGE');
          return failure(BrowserError.noActiveTab());
        }
        return this.translateImageHandler.handle(message.payload, senderTabId);
      }

      case 'START_OVERLAY':
        return this.startOverlayHandler.handle();

      case 'MOUNT_HISTORY_MODAL':
        return this.mountHistoryModalHandler.handle(message.payload);

      default:
        break;
    }
  }
}
