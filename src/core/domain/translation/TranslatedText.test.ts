import { describe, expect, test } from 'bun:test';
import { TranslatedText } from './TranslatedText';
import { DomainError } from '../shared/DomainError';

describe('Domain: TranslatedText', () => {
  // ==================== CREATE (happy path) ====================
  describe('create — valid', () => {
    test('creates from non-empty string', () => {
      const result = TranslatedText.create('Hello, world!');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe('Hello, world!');
      }
    });

    test('trims whitespace', () => {
      const result = TranslatedText.create('  trimmed  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe('trimmed');
      }
    });
  });

  // ==================== CREATE (failure path) ====================
  describe('create — invalid', () => {
    test('rejects empty string', () => {
      const result = TranslatedText.create('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
        expect(result.error.message).toContain('empty');
      }
    });

    test('rejects whitespace-only string', () => {
      const result = TranslatedText.create('   ');
      expect(result.success).toBe(false);
    });
  });

  // ==================== EQUALITY ====================
  describe('equality', () => {
    test('same values are equal', () => {
      const a = TranslatedText.create('Hello');
      const b = TranslatedText.create('Hello');
      if (a.success && b.success) {
        expect(a.data.equals(b.data)).toBe(true);
      }
    });

    test('different values are not equal', () => {
      const a = TranslatedText.create('Hello');
      const b = TranslatedText.create('World');
      if (a.success && b.success) {
        expect(a.data.equals(b.data)).toBe(false);
      }
    });
  });
});
