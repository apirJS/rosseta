import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { resetBrowserMock } from '../../../../../tests/browser-mock';
import { coordinatorFixture, translationIdentity as identity, translationOrigin as origin } from '../../../../../tests/background-translation-fixtures';
import { TranslateImageHandler } from './TranslateImageHandler';
import { TranslationJobCoordinator } from '../services/TranslationJobCoordinator';
import { VALID_IMAGE_BASE64 } from '../../../../../tests/test-fixtures';

const tabs = browser.tabs as unknown as { sendMessage: ReturnType<typeof mock> };

describe('Adapter: TranslateImageHandler', () => {
  beforeEach(() => { resetBrowserMock(); tabs.sendMessage.mockResolvedValue({ status: 'accepted' }); });
  afterEach(() => mock.restore());

  test('delegates the logical image job and trusted origin to the coordinator', async () => {
    const fixture = coordinatorFixture();
    const coordinator = new TranslationJobCoordinator(fixture.container, fixture.preparer);
    const run = spyOn(coordinator, 'handle');
    const handler = new TranslateImageHandler(fixture.container, coordinator);
    const payload = { ...identity, imageBase64: VALID_IMAGE_BASE64 };

    expect((await handler.handle(payload, origin)).success).toBe(true);
    expect(run).toHaveBeenCalledWith(payload, origin);
    expect(fixture.storage.storedCount).toBe(1);
    expect((await handler.status(identity, origin)).state).toBe('completed');
  });

  test('forwards owner-scoped cancellation and status without starting generation', async () => {
    const fixture = coordinatorFixture();
    const coordinator = new TranslationJobCoordinator(fixture.container, fixture.preparer);
    const cancel = spyOn(coordinator, 'cancel');
    const handler = new TranslateImageHandler(fixture.container, coordinator);

    handler.cancel(identity, origin);

    expect(cancel).toHaveBeenCalledWith(identity, origin);
    expect(await handler.status(identity, origin)).toEqual({ state: 'cancelled' });
    expect(fixture.generation).not.toHaveBeenCalled();
  });
});
