import { describe, expect, test } from 'bun:test';
import { Language } from './Language';
import { LANGUAGE_MAP } from './LANGUAGE_MAP';
import { DomainError } from '../shared/DomainError';

describe('Domain: Language', () => {
  // ==================== CREATE ====================
  describe('create', () => {
    test('creates English language', () => {
      const lang = Language.create('en-US');
      expect(lang.code).toBe('en-US');
      expect(lang.name).toBe(LANGUAGE_MAP['en-US']);
    });

    test('creates Japanese language', () => {
      const lang = Language.create('ja-JP');
      expect(lang.code).toBe('ja-JP');
      expect(lang.name).toBe(LANGUAGE_MAP['ja-JP']);
    });
  });

  // ==================== FROM RAW ====================
  describe('fromRaw', () => {
    test('accepts valid language code', () => {
      const result = Language.fromRaw('ko-KR');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('ko-KR');
      }
    });

    test('trims whitespace', () => {
      const result = Language.fromRaw('  ja-JP  ');
      expect(result.success).toBe(true);
    });

    test('rejects empty string', () => {
      const result = Language.fromRaw('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
        expect(result.error.message).toContain('non-empty');
      }
    });

    test('rejects unknown language code', () => {
      const result = Language.fromRaw('xx-FAKE');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Unknown language');
      }
    });
  });

  // ==================== EQUALITY ====================
  describe('equality', () => {
    test('same language codes are equal', () => {
      const a = Language.create('en-US');
      const b = Language.create('en-US');
      expect(a.equals(b)).toBe(true);
    });

    test('different language codes are not equal', () => {
      const a = Language.create('en-US');
      const b = Language.create('ja-JP');
      expect(a.equals(b)).toBe(false);
    });

    test('returns false when other is null/undefined', () => {
      const a = Language.create('en-US');
      // @ts-expect-error - testing runtime behavior
      expect(a.equals(null)).toBe(false);
      // @ts-expect-error - testing runtime behavior
      expect(a.equals(undefined)).toBe(false);
    });
  });
});
