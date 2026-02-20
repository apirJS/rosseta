import { describe, expect, test, mock, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { OverlayService } from './OverlayService';
import { container } from '../di-container';
import { resetBrowserMock } from '../../../../../tests/browser-mock';
import { seedCredentialsAndPreferences } from '../../../../../tests/test-fixtures';

const tabs = browser.tabs as unknown as {
  query: ReturnType<typeof mock>;
  sendMessage: ReturnType<typeof mock>;
  captureVisibleTab: ReturnType<typeof mock>;
};

describe('Service: OverlayService', () => {
  beforeEach(() => {
    resetBrowserMock();
  });

  test('authenticated user with active tab → sends MOUNT_OVERLAY', async () => {
    seedCredentialsAndPreferences();
    tabs.query.mockResolvedValue([{ id: 7 }]);
    tabs.sendMessage.mockResolvedValueOnce({ type: 'PONG' }); // PING
    tabs.captureVisibleTab.mockResolvedValueOnce(
      'data:image/jpeg;base64,screenshot',
    );

    const service = new OverlayService(container);
    await service.triggerOverlayOnActiveTab();

    const sendCalls = tabs.sendMessage.mock.calls;
    const mountCall = sendCalls.find(
      (c: unknown[]) =>
        (c[1] as { action: string })?.action === 'MOUNT_OVERLAY',
    );
    expect(mountCall).toBeDefined();
    expect(mountCall![0]).toBe(7);
    expect(
      (mountCall![1] as { payload: { rawImage: string } }).payload.rawImage,
    ).toBe('data:image/jpeg;base64,screenshot');
  });

  test('not authenticated → shows error toast, no MOUNT_OVERLAY', async () => {
    // Don't seed credentials — storage is empty
    tabs.query.mockResolvedValue([{ id: 3 }]);
    tabs.sendMessage
      .mockResolvedValueOnce({ type: 'PONG' }) // PING
      .mockResolvedValueOnce(undefined); // Toast

    const service = new OverlayService(container);
    await service.triggerOverlayOnActiveTab();

    const sendCalls = tabs.sendMessage.mock.calls;
    const toastCall = sendCalls.find(
      (c: unknown[]) => (c[1] as { action: string })?.action === 'SHOW_TOAST',
    );
    expect(toastCall).toBeDefined();

    const overlayCall = sendCalls.find(
      (c: unknown[]) =>
        (c[1] as { action: string })?.action === 'MOUNT_OVERLAY',
    );
    expect(overlayCall).toBeUndefined();
  });

  test('no active tab → returns early without error', async () => {
    seedCredentialsAndPreferences();
    tabs.query.mockResolvedValue([]);

    const service = new OverlayService(container);
    await service.triggerOverlayOnActiveTab();

    expect(tabs.captureVisibleTab).not.toHaveBeenCalled();
  });
});
