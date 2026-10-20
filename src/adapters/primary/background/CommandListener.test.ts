import { describe, expect, test, mock, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { CommandListener } from './CommandListener';
import { createBackgroundDependencies } from '../../../composition/background';
import { OverlayService } from './capture/OverlayService';
import { resetBrowserMock } from '../../../../tests/browser-mock';
import { seedCredentialsAndPreferences } from '../../../../tests/test-fixtures';

const container = createBackgroundDependencies();

const commands = browser.commands as unknown as {
  onCommand: { addListener: ReturnType<typeof mock> };
};

const tabs = browser.tabs as unknown as {
  query: ReturnType<typeof mock>;
  sendMessage: ReturnType<typeof mock>;
  captureVisibleTab: ReturnType<typeof mock>;
};

function getCallback() {
  const overlayService = new OverlayService(container);
  const listener = new CommandListener(overlayService);

  listener.register();

  return commands.onCommand.addListener.mock.calls[0][0] as (
    command: string,
  ) => Promise<void>;
}

describe('Adapter: CommandListener', () => {
  beforeEach(() => {
    resetBrowserMock();
  });

  test('START_EXTENSION triggers overlay on active tab', async () => {
    seedCredentialsAndPreferences();
    tabs.query.mockResolvedValueOnce([{ id: 5 }]);
    tabs.sendMessage.mockResolvedValueOnce({ type: 'PONG' }); // PING succeeds
    tabs.captureVisibleTab.mockResolvedValueOnce('data:image/jpeg;base64,img');

    const callback = getCallback();

    await callback('START_EXTENSION');

    // OverlayService should send MOUNT_OVERLAY to tab
    const sendCalls = tabs.sendMessage.mock.calls;

    const mountCall = sendCalls.find(
      (c: unknown[]) =>
        (c[1] as { action: string })?.action === 'MOUNT_OVERLAY',
    );

    expect(mountCall).toBeDefined();
  });

  test('unknown command does nothing', async () => {
    const callback = getCallback();

    await callback('UNKNOWN_COMMAND');

    // No tab messages sent for unknown commands
    expect(tabs.sendMessage).not.toHaveBeenCalled();
  });
});
