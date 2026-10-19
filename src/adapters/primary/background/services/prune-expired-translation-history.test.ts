import { resetBrowserMock, seedStore } from '../../../../../tests/browser-mock';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { GetAllTranslationsUseCase } from '../../../../core/application/translation/GetAllTranslationsUseCase';
import { BrowserTranslationStorageAdapter } from '../../../secondary/storage/BrowserTranslationStorageAdapter';
import { Translation } from '../../../../core/domain/translation/Translation';
import { StorageError } from '../../../../shared/errors';
import { failure } from '../../../../shared/types/Result';
import { pruneExpiredTranslationHistory } from './prune-expired-translation-history';

describe('Service: startup translation history retention', () => {
  let warn: ReturnType<typeof spyOn<typeof console, 'warn'>>;

  beforeEach(() => {
    resetBrowserMock();
    warn = spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  test('startup cleanup physically removes expired records before history is opened', async () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z');
    const expired = Translation.create('expired', [], [], '', new Date(now - 91 * 86400000));
    const recent = Translation.create('recent', [], [], '', new Date(now));
    seedStore({ translations: [expired.toProps(), recent.toProps()] });
    const useCase = new GetAllTranslationsUseCase(
      new BrowserTranslationStorageAdapter(() => now),
    );

    await pruneExpiredTranslationHistory(useCase);

    expect((await browser.storage.local.get('translations')).translations).toEqual([
      recent.toProps(),
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  test('logs a failed cleanup without rejecting startup', async () => {
    const error = StorageError.writeFailed('translations');

    await expect(pruneExpiredTranslationHistory({
      execute: async () => failure(error),
    })).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      '[TranslationHistory] Failed to prune expired history:', error,
    );
  });

  test('an unexpected storage exception does not reject startup', async () => {
    const error = new Error('unexpected');

    await expect(pruneExpiredTranslationHistory({
      execute: async () => { throw error; },
    })).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      '[TranslationHistory] Failed to prune expired history:', error,
    );
  });
});
