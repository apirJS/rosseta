import { sendMessageToTab } from '../../../../shared/messaging';
import {
  getActiveTab,
  injectContentScriptIfNeeded,
} from '../service-worker.utils';
import { TabNotifier } from '../services/TabNotifier';

/**
 * Payload shape for the MOUNT_HISTORY_MODAL action.
 */
interface MountHistoryModalPayload {
  id: string;
  original: {
    language: { code: string; name: string };
    text: string;
    romanization: string | null;
  }[];
  translated: {
    language: { code: string; name: string };
    text: string;
    romanization: string | null;
  }[];
  description: string;
  createdAt: Date;
}

/**
 * Handles the MOUNT_HISTORY_MODAL message action.
 * Injects content script if needed, shows an info toast,
 * then forwards the translation payload to mount a modal on the active tab.
 */
export class MountHistoryModalHandler {
  async handle(payload: MountHistoryModalPayload): Promise<void> {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      console.error('[MountHistoryModalHandler] No active tab found');
      return;
    }

    await injectContentScriptIfNeeded(activeTab.id);

    const notifier = new TabNotifier(activeTab.id);
    await notifier.showInfo('Opening Translation', 2000);

    await sendMessageToTab(activeTab.id, {
      action: 'MOUNT_TRANSLATION_MODAL',
      payload,
    });
  }
}
