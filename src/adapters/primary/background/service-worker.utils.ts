import * as browser from 'webextension-polyfill';
import { sendMessageToTab } from '../../../shared/messaging';

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
        files: ['src/adapters/primary/content/content-script.js'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function reloadExtension(): void {
  browser.runtime.reload();
}

export async function getActiveTab(): Promise<browser.Tabs.Tab | null> {
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tabs[0] ?? null;
}

export async function captureVisibleTab(): Promise<string> {
  return await browser.tabs.captureVisibleTab(undefined, {
    format: 'jpeg',
    quality: 85,
  });
}
