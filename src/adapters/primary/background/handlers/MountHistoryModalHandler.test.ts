import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { resetBrowserMock } from '../../../../../tests/browser-mock';
import { completeTranslation } from '../../../../../tests/background-translation-fixtures';
import { serializeForModal } from '../../../../shared/types/TranslationModalPayload';
import { MountHistoryModalHandler } from './MountHistoryModalHandler';

const tabs = browser.tabs as unknown as { query: ReturnType<typeof mock>; sendMessage: ReturnType<typeof mock> };

describe('Adapter: MountHistoryModalHandler', () => {
  beforeEach(() => { resetBrowserMock(); tabs.sendMessage.mockResolvedValue({ action: 'PONG' }); });

  test('preserves canonical completed history payload including metadata and date', async () => {
    tabs.query.mockResolvedValueOnce([{ id: 8 }]);
    const payload = serializeForModal(completeTranslation());
    await new MountHistoryModalHandler().handle(payload);
    const mounted = tabs.sendMessage.mock.calls.find(call => (call[1] as { action?: string })?.action === 'MOUNT_TRANSLATION_MODAL');
    expect(mounted?.[0]).toBe(8);
    expect(mounted?.[1]).toEqual({ action: 'MOUNT_TRANSLATION_MODAL', payload });
    expect(payload.original[0]?.blockIndex).toBe(0);
    expect(payload.createdAt).toBeInstanceOf(Date);
    expect(tabs.sendMessage.mock.calls.some(call => (call[1] as { action?: string })?.action === 'TRANSLATION_EVENT')).toBe(false);
  });

  test('does not mount when the active tab is unavailable', async () => {
    tabs.query.mockResolvedValueOnce([]);
    await new MountHistoryModalHandler().handle(serializeForModal(completeTranslation()));
    expect(tabs.sendMessage).not.toHaveBeenCalled();
  });
});
