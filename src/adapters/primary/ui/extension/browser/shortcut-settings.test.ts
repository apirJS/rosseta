import { beforeEach, describe, expect, test, vi } from 'vitest';
import { openShortcutSettings, shortcutSettingsUrl } from './shortcut-settings';

const api = vi.hoisted(() => ({
  commands: {
    openShortcutSettings: undefined as (() => Promise<void>) | undefined,
  },
  runtime: { getURL: vi.fn() },
  tabs: { create: vi.fn() },
}));

vi.mock('webextension-polyfill', () => api);

describe('UI navigation: browser shortcut settings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    api.commands.openShortcutSettings = undefined;
    api.runtime.getURL.mockReturnValue('chrome-extension://fixture/');
    api.tabs.create.mockReset().mockResolvedValue(undefined);
  });

  test.each([
    ['Chrome/140.0.0.0 Safari/537.36', 'chrome://extensions/shortcuts'],
    [
      'Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
      'edge://extensions/shortcuts',
    ],
    [
      'Chrome/140.0.0.0 Safari/537.36 OPR/124.0.0.0',
      'opera://settings/keyboardShortcuts',
    ],
    [
      'Chrome/140.0.0.0 Safari/537.36 Brave/140.0.0.0',
      'brave://extensions/shortcuts',
    ],
    [
      'Chrome/140.0.0.0 Safari/537.36 Vivaldi/7.7.0.0',
      'chrome://extensions/shortcuts',
    ],
  ])('opens the appropriate page for %s', async (agent, url) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(agent);
    expect(shortcutSettingsUrl()).toBe(url);
    await openShortcutSettings();
    expect(api.tabs.create).toHaveBeenCalledWith({ url });
  });

  test('invokes the native Firefox editor immediately, preserving the user gesture', async () => {
    api.runtime.getURL.mockReturnValue('moz-extension://fixture/');

    const nativeOpen = vi.fn().mockResolvedValue(undefined);

    api.commands.openShortcutSettings = nativeOpen;

    const pending = openShortcutSettings();

    expect(nativeOpen).toHaveBeenCalledOnce();
    await pending;
    expect(api.tabs.create).not.toHaveBeenCalled();
  });

  test.each(['missing', 'rejected'])(
    'uses official Firefox instructions if its native editor is %s',
    async (availability) => {
      api.runtime.getURL.mockReturnValue('moz-extension://fixture/');
      if (availability === 'rejected')
        api.commands.openShortcutSettings = vi
          .fn()
          .mockRejectedValue(new Error('Unavailable'));
      await openShortcutSettings();

      expect(api.tabs.create).toHaveBeenCalledWith({
        url: 'https://support.mozilla.org/en-US/kb/manage-extension-shortcuts-firefox',
      });
    },
  );

  test('propagates settings navigation errors so the popup can explain how to open it manually', async () => {
    api.tabs.create.mockRejectedValueOnce(new Error('Navigation blocked'));
    await expect(openShortcutSettings()).rejects.toThrow('Navigation blocked');
  });
});
