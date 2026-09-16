// IMPORTANT: mock.module must run before any adapter import
import { resetBrowserMock, seedStore } from '../../../../tests/browser-mock';
import { describe, test, expect, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { BrowserModelStorageAdapter } from './BrowserModelStorageAdapter';
import { ErrorCode } from '../../../shared/errors/ErrorCode';

const storage = browser.storage.local as unknown as {
  get: ReturnType<typeof import('bun:test').mock>;
  set: ReturnType<typeof import('bun:test').mock>;
  remove: ReturnType<typeof import('bun:test').mock>;
};

describe('Adapter: BrowserModelStorageAdapter', () => {
  const adapter = new BrowserModelStorageAdapter();

  beforeEach(() => resetBrowserMock());

  test('getModels() returns empty list when nothing stored', async () => {
    const result = await adapter.getModels('google');

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  test('setModels() round-trips models', async () => {
    await adapter.setModels('google', [
      { id: 'm1', name: 'M1', source: 'manual' },
      { id: 'm2', name: 'M2', source: 'fetched' },
    ]);

    const result = await adapter.getModels('google');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].source).toBe('manual');
    }
  });

  test('getModels() isolates providers', async () => {
    await adapter.setModels('google', [
      { id: 'g1', name: 'G1', source: 'fetched' },
    ]);
    await adapter.setModels('groq', [
      { id: 'q1', name: 'Q1', source: 'fetched' },
    ]);

    const groq = await adapter.getModels('groq');
    expect(groq.success).toBe(true);
    if (groq.success) {
      expect(groq.data.map((m) => m.id)).toEqual(['q1']);
    }
  });

  test('getModels() deletes corrupt data and returns empty list', async () => {
    seedStore({
      'models:google': [{ id: 'm1', name: 'M1', source: 'bogus-source' }],
    });

    const result = await adapter.getModels('google');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
    expect(storage.remove).toHaveBeenCalledWith('models:google');
  });

  test('getModels() deletes non-array data', async () => {
    seedStore({ 'models:google': 'not-an-array' });

    const result = await adapter.getModels('google');

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  test('getModels() returns StorageError on read failure', async () => {
    storage.get.mockImplementationOnce(async () => {
      throw new Error('read failed');
    });

    const result = await adapter.getModels('google');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });

  test('setModels() returns StorageError on write failure', async () => {
    storage.set.mockImplementationOnce(async () => {
      throw new Error('write failed');
    });

    const result = await adapter.setModels('google', []);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });

  test('clearModels() removes the storage key', async () => {
    await adapter.setModels('google', [
      { id: 'm1', name: 'M1', source: 'fetched' },
    ]);

    const result = await adapter.clearModels('google');

    expect(result.success).toBe(true);
    expect(storage.remove).toHaveBeenCalledWith('models:google');
  });

  test('getAllModels() returns models for every stored provider', async () => {
    await adapter.setModels('google', [
      { id: 'g1', name: 'G1', source: 'fetched' },
    ]);
    await adapter.setModels('custom-abc-123', [
      { id: 'c1', name: 'C1', source: 'fetched' },
    ]);
    seedStore({ credentials: { not: 'a model key' } });

    const result = await adapter.getAllModels();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual([
        'custom-abc-123',
        'google',
      ]);
      expect(result.data['google']).toHaveLength(1);
      expect(result.data['custom-abc-123'][0].id).toBe('c1');
    }
  });

  test('getAllModels() returns empty map when nothing stored', async () => {
    const result = await adapter.getAllModels();

    expect(result.success).toBe(true);
    if (result.success) expect(Object.keys(result.data)).toHaveLength(0);
  });

  test('getAllModels() deletes corrupt entries and keeps the rest', async () => {
    seedStore({
      'models:google': 'not-an-array',
      'models:groq': [{ id: 'q1', name: 'Q1', source: 'fetched' }],
    });

    const result = await adapter.getAllModels();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(['groq']);
    }
    expect(storage.remove).toHaveBeenCalledWith('models:google');
  });

  test('getAllModels() returns StorageError on read failure', async () => {
    storage.get.mockImplementationOnce(async () => {
      throw new Error('read failed');
    });

    const result = await adapter.getAllModels();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });
});
