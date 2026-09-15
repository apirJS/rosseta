import { describe, expect, test } from 'bun:test';
import { ApiKey } from './ApiKey';
import { DomainError } from '../shared/DomainError';

describe('Domain: ApiKey', () => {
  describe('createWithProvider', () => {
    test('accepts any non-empty key with explicit provider', () => {
      const result = ApiKey.createWithProvider(
        'AIzaSyA1234567890abcdefghijklmnopqrstuv',
        'google',
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('google');
        expect(result.data.value).toBe(
          'AIzaSyA1234567890abcdefghijklmnopqrstuv',
        );
      }
    });

    test('accepts keys of any format for any provider', () => {
      const result = ApiKey.createWithProvider('my-custom-key', 'mistral');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('mistral');
      }
    });

    test('trims leading and trailing whitespace', () => {
      const result = ApiKey.createWithProvider(
        '  AIzaSyA1234567890abcdefghijklmnopqrstuv  ',
        'google',
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(
          'AIzaSyA1234567890abcdefghijklmnopqrstuv',
        );
      }
    });

    test('rejects empty string', () => {
      const result = ApiKey.createWithProvider('', 'google');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
        expect(result.error.message).toContain('empty');
      }
    });

    test('rejects whitespace-only string', () => {
      const result = ApiKey.createWithProvider('   ', 'google');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
      }
    });
  });

  describe('fromRaw', () => {
    test('reconstructs with the stored provider', () => {
      const result = ApiKey.fromRaw('gsk_' + 'a'.repeat(52), 'groq');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('groq');
      }
    });

    test('rejects empty value', () => {
      const result = ApiKey.fromRaw('', 'groq');
      expect(result.success).toBe(false);
    });
  });
});
