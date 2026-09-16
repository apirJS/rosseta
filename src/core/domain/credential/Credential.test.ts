import { describe, expect, test } from 'bun:test';
import { Credential } from './Credential';
import { ApiKey } from './ApiKey';
import { DomainError } from '../shared/DomainError';

const VALID_GOOGLE_KEY = 'AIzaSyA1234567890abcdefghijklmnopqrstuv';
const VALID_GROQ_KEY = 'gsk_' + 'a'.repeat(52);

function makeApiKey(
  raw: string = VALID_GOOGLE_KEY,
  provider: 'google' | 'groq' = 'google',
): ApiKey {
  const r = ApiKey.createWithProvider(raw, provider);
  if (!r.success) throw new Error('Test helper: invalid API key');
  return r.data;
}

describe('Domain: Credential', () => {
  describe('create', () => {
    test('creates a valid credential', () => {
      const apiKey = makeApiKey();
      const result = Credential.create('cred-1', apiKey, 'google');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('cred-1');
        expect(result.data.provider).toBe('google');
        expect(result.data.type).toBe('API_KEY');
        expect(result.data.apiKey.value).toBe(VALID_GOOGLE_KEY);
      }
    });

    test('rejects empty ID', () => {
      const apiKey = makeApiKey();
      const result = Credential.create('', apiKey, 'google');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
        expect(result.error.message).toContain('ID');
      }
    });

    test('rejects whitespace-only ID', () => {
      const apiKey = makeApiKey();
      const result = Credential.create('   ', apiKey, 'google');
      expect(result.success).toBe(false);
    });
  });

  describe('fromProps', () => {
    test('reconstructs from valid props', () => {
      const result = Credential.fromProps({
        id: 'cred-1',
        type: 'API_KEY',
        provider: 'google',
        apiKey: VALID_GOOGLE_KEY,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('cred-1');
        expect(result.data.provider).toBe('google');
      }
    });

    test('fails on missing ID', () => {
      const result = Credential.fromProps({
        id: '',
        type: 'API_KEY',
        provider: 'groq',
        apiKey: VALID_GROQ_KEY,
      });
      expect(result.success).toBe(false);
    });

    test('fails on empty API key', () => {
      const result = Credential.fromProps({
        id: 'cred-1',
        type: 'API_KEY',
        provider: 'google',
        apiKey: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
