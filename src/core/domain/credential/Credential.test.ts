import { describe, expect, test } from 'bun:test';
import { Credential } from './Credential';
import { ApiKey } from './ApiKey';
import { DomainError } from '../shared/DomainError';

const VALID_GEMINI_KEY = 'AIzaSyA1234567890abcdefghijklmnopqrstuv';
const VALID_GROQ_KEY = 'gsk_' + 'a'.repeat(52);

function makeApiKey(raw: string = VALID_GEMINI_KEY): ApiKey {
  const r = ApiKey.create(raw);
  if (!r.success) throw new Error('Test helper: invalid API key');
  return r.data;
}

describe('Domain: Credential', () => {
  // ==================== CREATE ====================
  describe('create', () => {
    test('creates a valid Gemini credential', () => {
      const apiKey = makeApiKey();
      const result = Credential.create('cred-1', apiKey, 'gemini');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('cred-1');
        expect(result.data.provider).toBe('gemini');
        expect(result.data.type).toBe('API_KEY');
        expect(result.data.apiKey.value).toBe(VALID_GEMINI_KEY);
      }
    });

    test('rejects empty ID', () => {
      const apiKey = makeApiKey();
      const result = Credential.create('', apiKey, 'gemini');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
        expect(result.error.message).toContain('ID');
      }
    });

    test('rejects whitespace-only ID', () => {
      const apiKey = makeApiKey();
      const result = Credential.create('   ', apiKey, 'gemini');
      expect(result.success).toBe(false);
    });
  });

  // ==================== FROM PROPS ====================
  describe('fromProps', () => {
    test('reconstructs from valid props', () => {
      const result = Credential.fromProps({
        id: 'cred-1',
        type: 'API_KEY',
        provider: 'gemini',
        apiKey: VALID_GEMINI_KEY,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('cred-1');
        expect(result.data.provider).toBe('gemini');
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

    test('fails on invalid API key', () => {
      const result = Credential.fromProps({
        id: 'cred-1',
        type: 'API_KEY',
        provider: 'gemini',
        apiKey: 'invalid-key',
      });
      expect(result.success).toBe(false);
    });
  });

  // ==================== TO PROPS ====================
  describe('toProps', () => {
    test('round-trips through toProps and fromProps', () => {
      const apiKey = makeApiKey();
      const createResult = Credential.create('cred-1', apiKey, 'gemini');
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const props = createResult.data.toProps();
      expect(props).toEqual({
        id: 'cred-1',
        type: 'API_KEY',
        provider: 'gemini',
        apiKey: VALID_GEMINI_KEY,
      });

      const restored = Credential.fromProps(props);
      expect(restored.success).toBe(true);
      if (restored.success) {
        expect(restored.data.id).toBe('cred-1');
      }
    });
  });
});
