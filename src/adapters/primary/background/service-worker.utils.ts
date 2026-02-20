import * as browser from 'webextension-polyfill';
import { sendMessageToTab } from '../../../shared/messaging';

/**
 * Injects the content script into a tab if it hasn't been injected yet.
 * Uses a ping/pong mechanism to detect if the script is already running.
 * @param tabId - The ID of the tab to inject into
 * @returns True if content script is ready, false if injection failed
 */
export async function injectContentScriptIfNeeded(
  tabId: number,
): Promise<boolean> {
  try {
    const pong = await sendMessageToTab(tabId, {
      action: 'PING',
    });

    if (pong) {
      return true;
    }
  } catch {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['src/content-script.js'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Reloads the extension runtime.
 */
export function reloadExtension(): void {
  browser.runtime.reload();
}

/**
 * Gets the currently active tab in the current window.
 * @returns The active tab or null if none found
 */
export async function getActiveTab(): Promise<browser.Tabs.Tab | null> {
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tabs[0] ?? null;
}

/**
 * Captures the visible area of the current tab as a data URL.
 * Uses JPEG format for significantly smaller payloads (~10x vs PNG).
 * @returns Base64-encoded JPEG image
 */
export async function captureVisibleTab(): Promise<string> {
  return await browser.tabs.captureVisibleTab(undefined, {
    format: 'jpeg',
    quality: 85,
  });
}
