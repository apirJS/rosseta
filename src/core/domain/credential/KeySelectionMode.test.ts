import { describe, expect, test } from 'bun:test';
import { KeySelectionMode } from './KeySelectionMode';
import { DomainError } from '../shared/DomainError';

describe('Domain: KeySelectionMode', () => {
  // ==================== FACTORY METHODS ====================
  describe('static factories', () => {
    test('manual() creates manual mode', () => {
      const mode = KeySelectionMode.manual();
      expect(mode.value).toBe('manual');
      expect(mode.isManual).toBe(true);
      expect(mode.isAutoBalance).toBe(false);
      expect(mode.autoBalanceProvider).toBeNull();
    });

    test('autoBalanceGemini() creates gemini auto-balance mode', () => {
      const mode = KeySelectionMode.autoBalanceGemini();
      expect(mode.value).toBe('auto-balance:gemini');
      expect(mode.isManual).toBe(false);
      expect(mode.isAutoBalance).toBe(true);
      expect(mode.autoBalanceProvider).toBe('gemini');
    });

    test('autoBalanceGroq() creates groq auto-balance mode', () => {
      const mode = KeySelectionMode.autoBalanceGroq();
      expect(mode.value).toBe('auto-balance:groq');
      expect(mode.isManual).toBe(false);
      expect(mode.isAutoBalance).toBe(true);
      expect(mode.autoBalanceProvider).toBe('groq');
    });
  });

  // ==================== CREATE ====================
  describe('create', () => {
    test('creates from known values', () => {
      expect(KeySelectionMode.create('manual').value).toBe('manual');
      expect(KeySelectionMode.create('auto-balance:gemini').value).toBe(
        'auto-balance:gemini',
      );
      expect(KeySelectionMode.create('auto-balance:groq').value).toBe(
        'auto-balance:groq',
      );
    });
  });

  // ==================== FROM RAW ====================
  describe('fromRaw', () => {
    test('accepts valid mode strings', () => {
      for (const val of [
        'manual',
        'auto-balance:gemini',
        'auto-balance:groq',
      ] as const) {
        const result = KeySelectionMode.fromRaw(val);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.value).toBe(val);
      }
    });

    test('rejects empty string', () => {
      const result = KeySelectionMode.fromRaw('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
      }
    });

    test('rejects invalid value', () => {
      const result = KeySelectionMode.fromRaw('round-robin');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid key selection mode');
      }
    });
  });

  // ==================== LABEL ====================
  describe('label', () => {
    test('returns human-readable labels', () => {
      expect(KeySelectionMode.manual().label).toBe('Manual');
      expect(KeySelectionMode.autoBalanceGemini().label).toBe(
        'Auto balance (round robin) GEMINI',
      );
      expect(KeySelectionMode.autoBalanceGroq().label).toBe(
        'Auto balance (round robin) GROQ',
      );
    });
  });

  // ==================== EQUALITY ====================
  describe('equality', () => {
    test('same modes are equal', () => {
      expect(KeySelectionMode.manual().equals(KeySelectionMode.manual())).toBe(
        true,
      );
    });

    test('different modes are not equal', () => {
      expect(
        KeySelectionMode.manual().equals(KeySelectionMode.autoBalanceGemini()),
      ).toBe(false);
    });
  });
});
