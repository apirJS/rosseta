import { sendMessageToTab } from '../../../../shared/messaging';

export class TabNotifier {
  constructor(private readonly tabId: number) {}

  async showLoading(toastId: string, message: string): Promise<void> {
    await sendMessageToTab(this.tabId, {
      action: 'SHOW_TOAST',
      payload: { id: toastId, type: 'loading', message },
    });
  }

  async showSuccess(toastId: string, message: string): Promise<void> {
    await sendMessageToTab(this.tabId, {
      action: 'SHOW_TOAST',
      payload: { id: toastId, type: 'success', message },
    });
  }

  async showError(
    toastId: string,
    message: string,
    description?: string,
  ): Promise<void> {
    await sendMessageToTab(this.tabId, {
      action: 'SHOW_TOAST',
      payload: { id: toastId, type: 'error', message, description },
    });
  }

  async showInfo(message: string, duration?: number): Promise<void> {
    await sendMessageToTab(this.tabId, {
      action: 'SHOW_TOAST',
      payload: { type: 'info', message, duration },
    });
  }
}
