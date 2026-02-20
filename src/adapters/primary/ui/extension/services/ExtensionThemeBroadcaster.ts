import { sendMessageToTab } from '../../../../../shared/messaging';
import * as browser from 'webextension-polyfill';

/**
 * Service to broadcast theme changes to all active tabs.
 * This ensures content scripts (like the translation modal) stay in sync with the popup theme.
 */
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
      // Content script may not be injected yet or communication failed
      // This is expected when opening popup on a restricted page (e.g. chrome://)
      console.debug(
        '[ExtensionThemeBroadcaster] Failed to broadcast theme:',
        error,
      );
    }
  }
}
