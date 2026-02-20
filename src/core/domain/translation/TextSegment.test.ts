import { describe, expect, test } from 'bun:test';
import { TextSegment } from './TextSegment';
import { Language } from './Language';
import { DomainError } from '../shared/DomainError';

describe('Domain: TextSegment', () => {
  const japanese = Language.create('ja-JP');
  const english = Language.create('en-US');

  // ==================== CREATE (happy path) ====================
  describe('create — valid', () => {
    test('creates segment with text and language', () => {
      const result = TextSegment.create('こんにちは', japanese);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('こんにちは');
        expect(result.data.language.code).toBe('ja-JP');
        expect(result.data.romanization).toBeNull();
      }
    });

    test('creates segment with romanization', () => {
      const result = TextSegment.create('こんにちは', japanese, 'konnichiwa');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.romanization).toBe('konnichiwa');
      }
    });

    test('trims text and romanization', () => {
      const result = TextSegment.create('  Hello  ', english, '  hello  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('Hello');
        expect(result.data.romanization).toBe('hello');
      }
    });

    test('null romanization is preserved as null', () => {
      const result = TextSegment.create('Hello', english, null);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.romanization).toBeNull();
      }
    });

    test('empty romanization string becomes null', () => {
      const result = TextSegment.create('Hello', english, '');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.romanization).toBeNull();
      }
    });
  });

  // ==================== CREATE (failure path) ====================
  describe('create — invalid', () => {
    test('rejects empty text', () => {
      const result = TextSegment.create('', japanese);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
        expect(result.error.message).toContain('empty');
      }
    });

    test('rejects whitespace-only text', () => {
      const result = TextSegment.create('   ', japanese);
      expect(result.success).toBe(false);
    });
  });
});
