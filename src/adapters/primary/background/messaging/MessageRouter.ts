import * as browser from 'webextension-polyfill';
import { MessageSchema } from '../../../../shared/messaging/MessageSchema';
import { TranslateImageHandler } from '../translation/TranslateImageHandler';
import { StartOverlayHandler } from '../capture/StartOverlayHandler';
import { MountHistoryModalHandler } from '../history/MountHistoryModalHandler';
import { FetchModelsHandler } from '../providers/FetchModelsHandler';
import type { TranslationOrigin } from '../translation/TranslationRequestRegistry';
import { BrowserError } from '../../../../shared/errors';
import { failure, success } from '../../../../shared/types/Result';

export interface MessageRouterHandlers {
  translateImage: TranslateImageHandler;
  startOverlay: StartOverlayHandler;
  mountHistory: MountHistoryModalHandler;
  fetchModels: FetchModelsHandler;
}

export class MessageRouter {
  constructor(private readonly handlers: MessageRouterHandlers) {}

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

        const result = await this.handlers.translateImage.handle(
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
        return this.handlers.startOverlay.handle();

      case 'FETCH_MODELS':
        return this.handlers.fetchModels.handle(message.payload);

      case 'MOUNT_HISTORY_MODAL':
        return this.handlers.mountHistory.handle(message.payload);

      case 'CANCEL_TRANSLATION':
        {
          const origin = this.origin(sender);

          if (origin)
            this.handlers.translateImage.cancel(message.payload, origin);
        }

        return;

      case 'GET_TRANSLATION_STATUS': {
        const origin = this.origin(sender);

        return origin
          ? this.handlers.translateImage.status(message.payload, origin)
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
