import { sendMessageToTab } from '../../../../shared/messaging/index';

export class TabNotifier {
  constructor(
    private readonly tabId: number,
    private readonly target?: { frameId?: number; documentId?: string },
  ) {}

  async showLoading(toastId: string, message: string): Promise<void> {
    await sendMessageToTab(
      this.tabId,
      {
        action: 'SHOW_TOAST',
        payload: { id: toastId, type: 'loading', message },
      },
      this.target,
    );
  }

  async showSuccess(toastId: string, message: string): Promise<void> {
    await sendMessageToTab(
      this.tabId,
      {
        action: 'SHOW_TOAST',
        payload: { id: toastId, type: 'success', message },
      },
      this.target,
    );
  }

  async showError(
    toastId: string,
    message: string,
    description?: string,
  ): Promise<void> {
    await sendMessageToTab(
      this.tabId,
      {
        action: 'SHOW_TOAST',
        payload: { id: toastId, type: 'error', message, description },
      },
      this.target,
    );
  }

  async showInfo(message: string, duration?: number): Promise<void> {
    await sendMessageToTab(
      this.tabId,
      {
        action: 'SHOW_TOAST',
        payload: { type: 'info', message, duration },
      },
      this.target,
    );
  }
}
