import { sendMessageToTab } from '../../../../shared/messaging';
import {
  captureVisibleTab,
  getActiveTab,
  injectContentScriptIfNeeded,
} from '../service-worker.utils';
import { TabNotifier } from './TabNotifier';
import type { Container } from '../../../../shared/di/container-factory';

export class OverlayService {
  constructor(private readonly container: Container) {}

  async triggerOverlayOnActiveTab(): Promise<void> {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) return;

    const tabId = activeTab.id;

    const credentialsResult =
      await this.container.getCredentialsUseCase.execute();

    if (
      !credentialsResult.success ||
      !credentialsResult.data ||
      !credentialsResult.data.hasKeys()
    ) {
      await injectContentScriptIfNeeded(tabId);
      const notifier = new TabNotifier(tabId);
      await notifier.showError(
        `auth-error-${Date.now()}`,
        'Not Authenticated',
        'Please set your API key in the extension settings.',
      );
      return;
    }

    await injectContentScriptIfNeeded(tabId);
    await sendMessageToTab(tabId, {
      action: 'MOUNT_OVERLAY',
      payload: { rawImage: await captureVisibleTab() },
    });
  }
}
