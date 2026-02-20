import { describe, expect, test } from 'bun:test';
import { EncodedImage } from './EncodedImage';
import { DomainError } from '../shared/DomainError';

const VALID_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const VALID_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const VALID_WEBP =
  'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

describe('Domain: EncodedImage', () => {
  // ==================== CREATE (happy path) ====================
  describe('create — valid', () => {
    test('accepts a PNG data URL', () => {
      const result = EncodedImage.create(VALID_PNG);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(VALID_PNG);
      }
    });

    test('accepts a JPEG data URL', () => {
      const result = EncodedImage.create(VALID_JPEG);
      expect(result.success).toBe(true);
    });

    test('accepts a WebP data URL', () => {
      const result = EncodedImage.create(VALID_WEBP);
      expect(result.success).toBe(true);
    });
  });

  // ==================== CREATE (failure path) ====================
  describe('create — invalid', () => {
    test('rejects empty string', () => {
      const result = EncodedImage.create('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
        expect(result.error.message).toContain('empty');
      }
    });

    test('rejects non-data-URL string', () => {
      const result = EncodedImage.create('https://example.com/image.png');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('data:image/');
      }
    });

    test('rejects data URL with wrong scheme', () => {
      const result = EncodedImage.create('data:text/plain;base64,aGVsbG8=');
      expect(result.success).toBe(false);
    });
  });

  // ==================== GETTERS ====================
  describe('getters', () => {
    test('mimeType extracts correct MIME from PNG', () => {
      const result = EncodedImage.create(VALID_PNG);
      if (result.success) {
        expect(result.data.mimeType).toBe('image/png');
      }
    });

    test('mimeType extracts correct MIME from JPEG', () => {
      const result = EncodedImage.create(VALID_JPEG);
      if (result.success) {
        expect(result.data.mimeType).toBe('image/jpeg');
      }
    });

    test('mimeType extracts correct MIME from WebP', () => {
      const result = EncodedImage.create(VALID_WEBP);
      if (result.success) {
        expect(result.data.mimeType).toBe('image/webp');
      }
    });

    test('base64Data strips the data URL prefix', () => {
      const result = EncodedImage.create(VALID_PNG);
      if (result.success) {
        expect(result.data.base64Data).not.toContain('data:image');
        expect(result.data.base64Data).toBe(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        );
      }
    });
  });
});
