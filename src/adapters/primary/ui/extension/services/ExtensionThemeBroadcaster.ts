import { sendMessageToTab } from '../../../../../shared/messaging';
import * as browser from 'webextension-polyfill';

export class ExtensionThemeBroadcaster {
  static async broadcast(theme: 'dark' | 'light'): Promise<void> {
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      for (const tab of tabs) {
        if (tab.id) {
          await sendMessageToTab(tab.id, {
            action: 'THEME_CHANGED',
            payload: { theme },
          });
        }
      }
    } catch (error) {
      console.debug(
        '[ExtensionThemeBroadcaster] Failed to broadcast theme:',
        error,
      );
    }
  }
}
