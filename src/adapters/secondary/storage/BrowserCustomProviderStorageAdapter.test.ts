// IMPORTANT: mock.module must run before any adapter import
import { resetBrowserMock, seedStore } from '../../../../tests/browser-mock';
import { describe, test, expect, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { BrowserCustomProviderStorageAdapter } from './BrowserCustomProviderStorageAdapter';
import {
  CustomProviderConfig,
  type CustomProviderConfigProps,
} from '../../../core/domain/provider/CustomProviderConfig';
import { ErrorCode } from '../../../shared/errors/ErrorCode';

const storage = browser.storage.local as unknown as {
  get: ReturnType<typeof import('bun:test').mock>;
  set: ReturnType<typeof import('bun:test').mock>;
  remove: ReturnType<typeof import('bun:test').mock>;
};

function createConfig(
  overrides: Partial<CustomProviderConfigProps> = {},
): CustomProviderConfig {
  const result = CustomProviderConfig.create({
    id: 'custom-test-1',
    name: 'My Provider',
    baseURL: 'https://api.example.com/v1',
    ...overrides,
  });
  if (!result.success) throw new Error('bad config');
  return result.data;
}

describe('Adapter: BrowserCustomProviderStorageAdapter', () => {
  const adapter = new BrowserCustomProviderStorageAdapter();

  beforeEach(() => resetBrowserMock());

  test('load() returns an empty list when nothing stored', async () => {
    const result = await adapter.load();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });

  test('save() and load() round-trip the config', async () => {
    await adapter.save(
      createConfig({ headers: { 'X-Custom': 'value' } }),
    );

    const result = await adapter.load();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('My Provider');
      expect(result.data[0].baseURL).toBe('https://api.example.com/v1');
      expect(result.data[0].headers).toEqual({ 'X-Custom': 'value' });
    }
  });

  test('save() upserts by id', async () => {
    await adapter.save(createConfig({ id: 'custom-a', name: 'A' }));
    await adapter.save(createConfig({ id: 'custom-b', name: 'B' }));
    await adapter.save(createConfig({ id: 'custom-a', name: 'A2' }));

    const result = await adapter.load();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((p) => p.name).sort()).toEqual(['A2', 'B']);
    }
  });

  test('remove() deletes the provider', async () => {
    await adapter.save(createConfig({ id: 'custom-a', name: 'A' }));
    await adapter.save(createConfig({ id: 'custom-b', name: 'B' }));

    const removeResult = await adapter.remove('custom-a');
    expect(removeResult.success).toBe(true);

    const result = await adapter.load();
    if (result.success) {
      expect(result.data.map((p) => p.id)).toEqual(['custom-b']);
    }
  });

  test('load() deletes corrupt data and returns an empty list', async () => {
    seedStore({ customProviders: { providers: 'not-an-array' } });

    const result = await adapter.load();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
    expect(storage.remove).toHaveBeenCalledWith('customProviders');
  });

  test('load() drops entries that fail domain validation', async () => {
    seedStore({
      customProviders: {
        providers: [
          {
            id: 'custom-bad',
            name: 'Bad',
            baseURL: 'ftp://invalid-protocol',
          },
          {
            id: 'custom-good',
            name: 'Good',
            baseURL: 'https://api.example.com/v1',
          },
        ],
      },
    });

    const result = await adapter.load();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((p) => p.id)).toEqual(['custom-good']);
    }
  });

  test('load() ignores a stale activeId from earlier versions', async () => {
    seedStore({
      customProviders: {
        providers: [
          {
            id: 'custom-a',
            name: 'A',
            baseURL: 'https://api.example.com/v1',
          },
        ],
        activeId: 'custom-a',
      },
    });

    const result = await adapter.load();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((p) => p.id)).toEqual(['custom-a']);
    }
  });

  test('load() deletes the legacy single config without migrating it', async () => {
    seedStore({
      customProviderConfig: {
        name: 'Legacy Provider',
        baseURL: 'https://legacy.example.com/v1',
        supportsStructuredOutputs: true,
      },
    });

    const result = await adapter.load();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
    expect(storage.remove).toHaveBeenCalledWith('customProviderConfig');
  });

  test('load() deletes a corrupt legacy config', async () => {
    seedStore({ customProviderConfig: { baseURL: 'not-a-full-config' } });

    const result = await adapter.load();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
    expect(storage.remove).toHaveBeenCalledWith('customProviderConfig');
  });

  test('save() surfaces write failures', async () => {
    storage.set.mockImplementationOnce(async () => {
      throw new Error('quota exceeded');
    });

    const result = await adapter.save(createConfig());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });
});
