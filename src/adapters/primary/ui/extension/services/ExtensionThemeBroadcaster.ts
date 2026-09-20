import { sendMessageToTab } from '../../../../../shared/messaging';
import * as browser from 'webextension-polyfill';

export const ExtensionThemeBroadcaster = {
  async broadcast(theme: 'dark' | 'light'): Promise<void> {
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      await Promise.all(
        tabs.flatMap((tab) =>
          tab.id
            ? [
                sendMessageToTab(tab.id, {
                  action: 'THEME_CHANGED',
                  payload: { theme },
                }),
              ]
            : [],
        ),
      );
    } catch (error) {
      console.debug(
        '[ExtensionThemeBroadcaster] Failed to broadcast theme:',
        error,
      );
    }
  },
};
