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

// ── Helpers ──────────────────────────────────────────────────────────

function createCredentials() {
  const apiKey = ApiKey.create('AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
  if (!apiKey.success) throw new Error('bad key');
  const cred = Credential.create(uuidv4(), apiKey.data, 'gemini');
  if (!cred.success) throw new Error('bad cred');
  return Credentials.createEmpty('creds-1').add(cred.data);
}

// Cast storage.local for mock method access
const storage = browser.storage.local as unknown as {
  get: ReturnType<typeof import('bun:test').mock>;
  set: ReturnType<typeof import('bun:test').mock>;
  remove: ReturnType<typeof import('bun:test').mock>;
};

// ── Tests ────────────────────────────────────────────────────────────

describe('Adapter: BrowserCredentialStorageAdapter', () => {
  const adapter = new BrowserCredentialStorageAdapter();

  beforeEach(() => resetBrowserMock());

  // ── save ────────────────────────────────────────────────────────
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

  // ── get ─────────────────────────────────────────────────────────
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

  test('get() migrates legacy single credential to aggregate', async () => {
    seedStore({
      credential: {
        id: 'legacy-id',
        type: 'API_KEY',
        apiKey: 'AIzaSy_LegacyKey123456789012345',
      },
    });

    const result = await adapter.get();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data?.items[0].apiKey.value).toBe(
        'AIzaSy_LegacyKey123456789012345',
      );
    }
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
