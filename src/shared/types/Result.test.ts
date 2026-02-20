import { describe, expect, test } from 'bun:test';
import { success, failure, type Result } from './Result';

describe('Shared: Result', () => {
  // ==================== success() ====================
  describe('success()', () => {
    test('creates a success result with data', () => {
      const result = success(42);

      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    test('works with complex data', () => {
      const result = success({ name: 'test', items: [1, 2, 3] });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('test');
      expect(result.data.items).toHaveLength(3);
    });

    test('works with undefined data', () => {
      const result = success(undefined);

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    test('works with null data', () => {
      const result = success(null);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  // ==================== failure() ====================
  describe('failure()', () => {
    test('creates a failure result with error', () => {
      const error = new Error('bad');
      const result = failure(error);

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });

    test('works with string error', () => {
      const result = failure('something went wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('something went wrong');
    });
  });

  // ==================== TYPE NARROWING ====================
  describe('type narrowing', () => {
    test('discriminates between success and failure', () => {
      const pass: Result<number, string> = success(42);
      const fail: Result<number, string> = failure('oops');

      if (pass.success) {
        expect(pass.data).toBe(42);
      } else {
        throw new Error('Should be success');
      }

      if (!fail.success) {
        expect(fail.error).toBe('oops');
      } else {
        throw new Error('Should be failure');
      }
    });
  });
});
