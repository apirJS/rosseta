import * as browser from 'webextension-polyfill';
import type {
  Message,
  MessageByAction,
  MessageReturnTypeMap,
} from './validation/MessageSchema';

/**
 * Sends a message to the background.
 * Uses <T> to lock the input 'action' to the output 'response'.
 */
export async function sendMessageToRuntime<T extends Message['action']>(
  message: MessageByAction<T>,
): Promise<MessageReturnTypeMap[T]> {
  return await browser.runtime.sendMessage(message);
}

/**
 * Sends a message to a tab.
 */
export async function sendMessageToTab<T extends Message['action']>(
  tabId: number,
  message: MessageByAction<T>,
): Promise<MessageReturnTypeMap[T]> {
  return await browser.tabs.sendMessage(tabId, message);
}
