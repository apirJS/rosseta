// IMPORTANT: mock.module must run before any adapter import
import { resetBrowserMock, seedStore } from '../../../../tests/browser-mock';
import { describe, test, expect, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { BrowserStructuredOutputExemptionStorage } from './BrowserStructuredOutputExemptionStorage';
import { ErrorCode } from '../../../shared/errors/ErrorCode';

const storage = browser.storage.local as unknown as {
  get: ReturnType<typeof import('bun:test').mock>;
  set: ReturnType<typeof import('bun:test').mock>;
  remove: ReturnType<typeof import('bun:test').mock>;
};

describe('Adapter: BrowserStructuredOutputExemptionStorage', () => {
  const adapter = new BrowserStructuredOutputExemptionStorage();

  beforeEach(() => resetBrowserMock());

  test('isExempt() returns false when storage is empty', async () => {
    const result = await adapter.isExempt('groq:llama-3.2-90b-vision');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(false);
    }
  });

  test('exemptModel() persists the key and isExempt() finds it', async () => {
    const write = await adapter.exemptModel('groq:llama-3.2-90b-vision');
    expect(write.success).toBe(true);

    const read = await adapter.isExempt('groq:llama-3.2-90b-vision');
    expect(read.success).toBe(true);
    if (read.success) {
      expect(read.data).toBe(true);
    }
    expect(storage.set).toHaveBeenCalledWith({
      structuredOutputExemptModels: ['groq:llama-3.2-90b-vision'],
    });
  });

  test('exemptModel() keeps existing entries and skips duplicates', async () => {
    seedStore({
      structuredOutputExemptModels: ['groq:meta-llama/llama-4-scout'],
    });

    const write = await adapter.exemptModel('groq:llama-3.2-90b-vision');
    expect(write.success).toBe(true);
    expect(storage.set).toHaveBeenCalledWith({
      structuredOutputExemptModels: [
        'groq:meta-llama/llama-4-scout',
        'groq:llama-3.2-90b-vision',
      ],
    });

    const duplicate = await adapter.exemptModel(
      'groq:meta-llama/llama-4-scout',
    );
    expect(duplicate.success).toBe(true);
    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  test('isExempt() returns false and deletes a corrupt stored value', async () => {
    seedStore({ structuredOutputExemptModels: { not: 'a list' } });

    const result = await adapter.isExempt('groq:llama-3.2-90b-vision');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(false);
    }
    expect(storage.remove).toHaveBeenCalledWith(
      'structuredOutputExemptModels',
    );
  });

  test('exemptModel() overwrites a corrupt stored value', async () => {
    seedStore({ structuredOutputExemptModels: 'garbage' });

    const write = await adapter.exemptModel('groq:llama-3.2-90b-vision');

    expect(write.success).toBe(true);
    expect(storage.set).toHaveBeenCalledWith({
      structuredOutputExemptModels: ['groq:llama-3.2-90b-vision'],
    });
  });

  test('isExempt() maps a read failure to a StorageError', async () => {
    storage.get.mockRejectedValueOnce(new Error('storage exploded'));

    const result = await adapter.isExempt('groq:llama-3.2-90b-vision');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });

  test('exemptModel() maps a write failure to a StorageError', async () => {
    storage.set.mockRejectedValueOnce(new Error('quota exceeded'));

    const result = await adapter.exemptModel('groq:llama-3.2-90b-vision');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });
});
