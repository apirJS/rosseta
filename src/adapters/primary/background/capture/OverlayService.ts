import { sendMessageToTab } from '../../../../shared/messaging/index';
import {
  captureVisibleTab,
  getActiveTab,
  injectContentScriptIfNeeded,
} from './service-worker.utils';
import { TabNotifier } from './TabNotifier';
import type { IGetCredentialsUseCase } from '../../../../core/ports/inbound/credentials/IGetCredentialUseCase';

export interface OverlayDependencies {
  getCredentialsUseCase: IGetCredentialsUseCase;
}

export class OverlayService {
  constructor(private readonly deps: OverlayDependencies) {}

  async triggerOverlayOnActiveTab(): Promise<void> {
    const activeTab = await getActiveTab();

    if (!activeTab?.id) return;

    const tabId = activeTab.id;

    const credentialsResult = await this.deps.getCredentialsUseCase.execute();

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
