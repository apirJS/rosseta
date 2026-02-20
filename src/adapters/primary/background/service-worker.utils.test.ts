import { describe, expect, test, mock, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import {
  injectContentScriptIfNeeded,
  getActiveTab,
  captureVisibleTab,
  reloadExtension,
} from './service-worker.utils';
import { resetBrowserMock } from '../../../../tests/browser-mock';

const tabs = browser.tabs as unknown as {
  query: ReturnType<typeof mock>;
  sendMessage: ReturnType<typeof mock>;
  captureVisibleTab: ReturnType<typeof mock>;
};

const scripting = browser.scripting as unknown as {
  executeScript: ReturnType<typeof mock>;
};

const runtime = browser.runtime as unknown as {
  reload: ReturnType<typeof mock>;
};

describe('service-worker.utils', () => {
  beforeEach(() => {
    resetBrowserMock();
  });

  describe('injectContentScriptIfNeeded', () => {
    test('returns true when PING succeeds (script already injected)', async () => {
      tabs.sendMessage.mockResolvedValueOnce({ type: 'PONG' });

      const result = await injectContentScriptIfNeeded(1);

      expect(result).toBe(true);
      expect(scripting.executeScript).not.toHaveBeenCalled();
    });

    test('injects script when PING fails, returns true', async () => {
      tabs.sendMessage.mockRejectedValueOnce(
        new Error('Could not establish connection'),
      );
      scripting.executeScript.mockResolvedValueOnce(undefined);

      const result = await injectContentScriptIfNeeded(1);

      expect(result).toBe(true);
      expect(scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        files: ['src/content-script.js'],
      });
    });

    test('returns false when both PING and injection fail', async () => {
      tabs.sendMessage.mockRejectedValueOnce(new Error('no connection'));
      scripting.executeScript.mockRejectedValueOnce(
        new Error('Cannot access chrome:// URL'),
      );

      const result = await injectContentScriptIfNeeded(1);

      expect(result).toBe(false);
    });
  });

  describe('getActiveTab', () => {
    test('returns the first active tab', async () => {
      const mockTab = { id: 5, url: 'https://example.com' };
      tabs.query.mockResolvedValueOnce([mockTab]);

      const result = await getActiveTab();

      expect(result?.id).toBe(5);
      expect(tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
    });

    test('returns null when no active tabs', async () => {
      tabs.query.mockResolvedValueOnce([]);

      const result = await getActiveTab();

      expect(result).toBeNull();
    });
  });

  describe('captureVisibleTab', () => {
    test('captures with JPEG format at quality 85', async () => {
      tabs.captureVisibleTab.mockResolvedValueOnce(
        'data:image/jpeg;base64,...',
      );

      const result = await captureVisibleTab();

      expect(result).toBe('data:image/jpeg;base64,...');
      expect(tabs.captureVisibleTab).toHaveBeenCalledWith(undefined, {
        format: 'jpeg',
        quality: 85,
      });
    });
  });

  describe('reloadExtension', () => {
    test('calls browser.runtime.reload()', () => {
      reloadExtension();
      expect(runtime.reload).toHaveBeenCalled();
    });
  });
});
