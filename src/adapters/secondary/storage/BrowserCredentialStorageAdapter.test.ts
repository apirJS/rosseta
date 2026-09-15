// IMPORTANT: mock.module must run before any adapter import
import { resetBrowserMock, seedStore } from '../../../../tests/browser-mock';
import { describe, test, expect, beforeEach } from 'bun:test';
import * as browser from 'webextension-polyfill';
import { BrowserCredentialStorageAdapter } from './BrowserCredentialStorageAdapter';
import { Credentials } from '../../../core/domain/credential/Credentials';
import { Credential } from '../../../core/domain/credential/Credential';
import { ApiKey } from '../../../core/domain/credential/ApiKey';
import { ErrorCode } from '../../../shared/errors/ErrorCode';
import { v4 as uuidv4 } from 'uuid';

function createCredentials() {
  const apiKey = ApiKey.createWithProvider(
    'AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'google',
  );
  if (!apiKey.success) throw new Error('bad key');
  const cred = Credential.create(uuidv4(), apiKey.data, 'google');
  if (!cred.success) throw new Error('bad cred');
  return Credentials.createEmpty('creds-1').add(cred.data);
}

const storage = browser.storage.local as unknown as {
  get: ReturnType<typeof import('bun:test').mock>;
  set: ReturnType<typeof import('bun:test').mock>;
  remove: ReturnType<typeof import('bun:test').mock>;
};

describe('Adapter: BrowserCredentialStorageAdapter', () => {
  const adapter = new BrowserCredentialStorageAdapter();

  beforeEach(() => resetBrowserMock());

  test('save() writes credentials to storage', async () => {
    const credentials = createCredentials();
    const result = await adapter.save(credentials);
    expect(result.success).toBe(true);

    const getResult = await adapter.get();
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data).not.toBeNull();
      expect(getResult.data?.id).toBe('creds-1');
    }
  });

  test('save() returns StorageError on write failure', async () => {
    const credentials = createCredentials();
    storage.set.mockImplementationOnce(async () => {
      throw new Error('disk full');
    });

    const result = await adapter.save(credentials);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });

  test('get() returns null when storage is empty', async () => {
    const result = await adapter.get();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  test('get() reconstructs Credentials from valid stored props', async () => {
    const credentials = createCredentials();
    await adapter.save(credentials);

    const result = await adapter.get();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data).toBeInstanceOf(Credentials);
      expect(result.data?.id).toBe('creds-1');
      expect(result.data?.hasKeys()).toBe(true);
    }
  });

  test('get() deletes the legacy single-credential key without migrating it', async () => {
    seedStore({
      credential: {
        id: 'legacy-id',
        type: 'API_KEY',
        apiKey: 'AIzaSy_LegacyKey123456789012345',
      },
    });

    const result = await adapter.get();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();

    expect(storage.remove).toHaveBeenCalledWith('credential');
  });

  test('get() deletes legacy gemini provider items instead of migrating', async () => {
    seedStore({
      credentials: {
        id: 'creds-1',
        activeCredentialId: 'cred-1',
        items: [
          {
            id: 'cred-1',
            type: 'API_KEY',
            provider: 'gemini',
            apiKey: 'AIzaSy_LegacyKey123456789012345',
          },
        ],
      },
    });

    const result = await adapter.get();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.items).toHaveLength(0);
    }
  });

  test('get() deletes legacy zai provider items instead of migrating', async () => {
    seedStore({
      credentials: {
        id: 'creds-1',
        activeCredentialId: 'cred-1',
        items: [
          {
            id: 'cred-1',
            type: 'API_KEY',
            provider: 'zai',
            apiKey: 'legacy-xai-key-value',
          },
        ],
      },
    });

    const result = await adapter.get();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.items).toHaveLength(0);
    }
  });

  test('get() drops items with unknown providers and fixes the active id', async () => {
    seedStore({
      credentials: {
        id: 'creds-1',
        activeCredentialId: 'bogus-cred',
        items: [
          {
            id: 'bogus-cred',
            type: 'API_KEY',
            provider: 'not-a-provider',
            apiKey: 'key-1',
          },
          {
            id: 'valid-cred',
            type: 'API_KEY',
            provider: 'google',
            apiKey: 'key-2',
          },
        ],
      },
    });

    const result = await adapter.get();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items[0].id).toBe('valid-cred');
      expect(result.data?.activeCredentialId).toBe('valid-cred');
    }

    const stored = await browser.storage.local.get('credentials');
    const storedItems = (stored.credentials as { items: unknown[] }).items;
    expect(storedItems).toHaveLength(1);
  });

  test('get() does not rewrite storage when data is clean', async () => {
    const credentials = createCredentials();
    await adapter.save(credentials);
    storage.set.mockClear();

    await adapter.get();

    expect(storage.set).not.toHaveBeenCalled();
  });

  test('get() cleans up corrupt data and returns null', async () => {
    seedStore({ credentials: { garbage: true } });

    const result = await adapter.get();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  test('get() returns StorageError on read failure', async () => {
    storage.get.mockImplementationOnce(async () => {
      throw new Error('read failed');
    });

    const result = await adapter.get();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    }
  });
});
