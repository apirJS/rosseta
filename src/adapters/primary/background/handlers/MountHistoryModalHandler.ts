import { sendMessageToTab } from '../../../../shared/messaging';
import type { TranslationModalPayload } from '../../../../shared/types/TranslationModalPayload';
import {
  getActiveTab,
  injectContentScriptIfNeeded,
} from '../service-worker.utils';
import { TabNotifier } from '../services/TabNotifier';

export class MountHistoryModalHandler {
  async handle(payload: TranslationModalPayload): Promise<void> {
    const activeTab = await getActiveTab();
    if (typeof activeTab?.id !== 'number') {
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
