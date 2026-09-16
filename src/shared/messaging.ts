import * as browser from 'webextension-polyfill';
import type {
  Message,
  MessageByAction,
  MessageReturnTypeMap,
} from './validation/MessageSchema';

export async function sendMessageToRuntime<T extends Message['action']>(
  message: MessageByAction<T>,
): Promise<MessageReturnTypeMap[T]> {
  return await browser.runtime.sendMessage(message);
}

export async function sendMessageToTab<T extends Message['action']>(
  tabId: number,
  message: MessageByAction<T>,
): Promise<MessageReturnTypeMap[T]> {
  return await browser.tabs.sendMessage(tabId, message);
}
