import * as browser from 'webextension-polyfill';
import { MessageSchema } from '../../../shared/validation/MessageSchema';
import { TranslateImageHandler } from './handlers/TranslateImageHandler';
import { StartOverlayHandler } from './handlers/StartOverlayHandler';
import { MountHistoryModalHandler } from './handlers/MountHistoryModalHandler';
import { FetchModelsHandler } from './handlers/FetchModelsHandler';
import type { TranslationOrigin } from './services/TranslationRequestRegistry';
import type { OverlayService } from './services/OverlayService';
import { BrowserError } from '../../../shared/errors';
import { failure, success } from '../../../shared/types/Result';
import type { Container } from '../../../shared/di/container-factory';

export class MessageRouter {
  private readonly translateImageHandler: TranslateImageHandler;
  private readonly startOverlayHandler: StartOverlayHandler;
  private readonly mountHistoryModalHandler: MountHistoryModalHandler;
  private readonly fetchModelsHandler: FetchModelsHandler;

  constructor(container: Container, overlayService: OverlayService) {
    this.translateImageHandler = new TranslateImageHandler(container);
    this.startOverlayHandler = new StartOverlayHandler(overlayService);
    this.mountHistoryModalHandler = new MountHistoryModalHandler();
    this.fetchModelsHandler = new FetchModelsHandler(container);
  }

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
        const origin = this.origin(sender);
        if (!origin) {
          console.error('[MessageRouter] No sender tab for TRANSLATE_IMAGE');
          return failure(BrowserError.noActiveTab());
        }

        const result = await this.translateImageHandler.handle(
          message.payload,
          origin,
        );
        return result.success
          ? success(undefined)
          : failure({
              code: result.error.code,
              message: result.error.userMessage,
              userMessage: result.error.userMessage,
            });
      }

      case 'START_OVERLAY':
        return this.startOverlayHandler.handle();

      case 'FETCH_MODELS':
        return this.fetchModelsHandler.handle(message.payload);

      case 'MOUNT_HISTORY_MODAL':
        return this.mountHistoryModalHandler.handle(message.payload);

      case 'CANCEL_TRANSLATION':
        {
          const origin = this.origin(sender);
          if (origin)
            this.translateImageHandler.cancel(message.payload, origin);
        }
        return;

      case 'GET_TRANSLATION_STATUS': {
        const origin = this.origin(sender);
        return origin
          ? this.translateImageHandler.status(message.payload, origin)
          : { state: 'unknown' as const };
      }

      default:
        break;
    }
  }

  private origin(
    sender: browser.Runtime.MessageSender,
  ): TranslationOrigin | null {
    const tabId = sender.tab?.id;
    if (typeof tabId !== 'number') return null;
    return {
      tabId,
      frameId: sender.frameId ?? 0,
      documentId: sender.documentId,
    };
  }
}
