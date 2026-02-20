import { describe, expect, test, mock } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { TabNotifier } from './TabNotifier';

const tabMessaging = browser.tabs as unknown as {
  sendMessage: ReturnType<typeof mock>;
};

describe('Service: TabNotifier', () => {
  const TAB_ID = 42;

  test('showLoading sends SHOW_TOAST with type loading', async () => {
    const notifier = new TabNotifier(TAB_ID);
    await notifier.showLoading('toast-1', 'Translating...');

    expect(tabMessaging.sendMessage).toHaveBeenCalledWith(TAB_ID, {
      action: 'SHOW_TOAST',
      payload: { id: 'toast-1', type: 'loading', message: 'Translating...' },
    });
  });

  test('showSuccess sends SHOW_TOAST with type success', async () => {
    const notifier = new TabNotifier(TAB_ID);
    await notifier.showSuccess('toast-1', 'Done!');

    expect(tabMessaging.sendMessage).toHaveBeenCalledWith(TAB_ID, {
      action: 'SHOW_TOAST',
      payload: { id: 'toast-1', type: 'success', message: 'Done!' },
    });
  });

  test('showError sends SHOW_TOAST with type error and description', async () => {
    const notifier = new TabNotifier(TAB_ID);
    await notifier.showError('toast-1', 'Failed', 'Something went wrong');

    expect(tabMessaging.sendMessage).toHaveBeenCalledWith(TAB_ID, {
      action: 'SHOW_TOAST',
      payload: {
        id: 'toast-1',
        type: 'error',
        message: 'Failed',
        description: 'Something went wrong',
      },
    });
  });

  test('showInfo sends SHOW_TOAST with type info and duration', async () => {
    const notifier = new TabNotifier(TAB_ID);
    await notifier.showInfo('Opening...', 2000);

    expect(tabMessaging.sendMessage).toHaveBeenCalledWith(TAB_ID, {
      action: 'SHOW_TOAST',
      payload: { type: 'info', message: 'Opening...', duration: 2000 },
    });
  });
});
