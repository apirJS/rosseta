import { describe, expect, test } from 'bun:test';
import { ApiKey } from './ApiKey';
import { DomainError } from '../shared/DomainError';

describe('Domain: ApiKey', () => {
  // ==================== VALID KEYS ====================
  describe('create — valid keys', () => {
    test('accepts a valid Gemini key (AIza prefix)', () => {
      const result = ApiKey.create('AIzaSyA1234567890abcdefghijklmnopqrstuv');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('gemini');
        expect(result.data.value).toBe(
          'AIzaSyA1234567890abcdefghijklmnopqrstuv',
        );
      }
    });

    test('accepts a valid Groq key (gsk_ prefix)', () => {
      const key = 'gsk_' + 'a'.repeat(52);
      const result = ApiKey.create(key);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('groq');
        expect(result.data.value).toBe(key);
      }
    });

    test('trims leading and trailing whitespace', () => {
      const result = ApiKey.create(
        '  AIzaSyA1234567890abcdefghijklmnopqrstuv  ',
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(
          'AIzaSyA1234567890abcdefghijklmnopqrstuv',
        );
      }
    });
  });

  // ==================== INVALID KEYS ====================
  describe('create — invalid keys', () => {
    test('rejects empty string', () => {
      const result = ApiKey.create('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
        expect(result.error.message).toContain('empty');
      }
    });

    test('rejects whitespace-only string', () => {
      const result = ApiKey.create('   ');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
      }
    });

    test('rejects key with unknown prefix', () => {
      const result = ApiKey.create('sk-1234567890abcdefghijklmnop');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('AIza');
        expect(result.error.message).toContain('gsk_');
      }
    });

    test('rejects random gibberish', () => {
      const result = ApiKey.create('not-a-valid-key');
      expect(result.success).toBe(false);
    });
  });

  // ==================== EQUALITY ====================
  describe('equality', () => {
    test('two ApiKeys with same value are equal', () => {
      const a = ApiKey.create('AIzaSyA1234567890abcdefghijklmnopqrstuv');
      const b = ApiKey.create('AIzaSyA1234567890abcdefghijklmnopqrstuv');
      if (a.success && b.success) {
        expect(a.data.equals(b.data)).toBe(true);
      }
    });

    test('two ApiKeys with different values are not equal', () => {
      const a = ApiKey.create('AIzaSyA1234567890abcdefghijklmnopqrstuv');
      const b = ApiKey.create('gsk_' + 'x'.repeat(52));
      if (a.success && b.success) {
        expect(a.data.equals(b.data)).toBe(false);
      }
    });
  });
});
