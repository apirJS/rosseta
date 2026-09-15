import { describe, expect, test } from 'bun:test';
import { KeySelectionMode } from './KeySelectionMode';
import { DomainError } from '../shared/DomainError';

describe('Domain: KeySelectionMode', () => {
  describe('static factories', () => {
    test('manual() creates manual mode', () => {
      const mode = KeySelectionMode.manual();
      expect(mode.value).toBe('manual');
      expect(mode.isManual).toBe(true);
      expect(mode.isAutoBalance).toBe(false);
      expect(mode.autoBalanceProvider).toBeNull();
    });

    test('autoBalance() creates auto-balance mode for any provider', () => {
      const mode = KeySelectionMode.autoBalance('google');
      expect(mode.value).toBe('auto-balance:google');
      expect(mode.isManual).toBe(false);
      expect(mode.isAutoBalance).toBe(true);
      expect(mode.autoBalanceProvider).toBe('google');
    });

    test('autoBalance() works for every provider', () => {
      for (const provider of [
        'google',
        'groq',
        'xai',
        'openai',
        'anthropic',
        'mistral',
        'deepinfra',
      ] as const) {
        const mode = KeySelectionMode.autoBalance(provider);
        expect(mode.autoBalanceProvider).toBe(provider);
      }
    });
  });

  describe('create', () => {
    test('creates from known values', () => {
      expect(KeySelectionMode.create('manual').value).toBe('manual');
      expect(KeySelectionMode.create('auto-balance:google').value).toBe(
        'auto-balance:google',
      );
      expect(KeySelectionMode.create('auto-balance:groq').value).toBe(
        'auto-balance:groq',
      );
    });
  });

  describe('fromRaw', () => {
    test('accepts valid mode strings', () => {
      for (const val of [
        'manual',
        'auto-balance:google',
        'auto-balance:groq',
        'auto-balance:xai',
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

    test('rejects auto-balance with unknown provider', () => {
      const result = KeySelectionMode.fromRaw('auto-balance:not-a-provider');
      expect(result.success).toBe(false);
    });

    test('rejects auto-balance with empty provider', () => {
      const result = KeySelectionMode.fromRaw('auto-balance:');
      expect(result.success).toBe(false);
    });

    test('rejects legacy providers that no longer exist', () => {
      const result = KeySelectionMode.fromRaw('auto-balance:azure');
      expect(result.success).toBe(false);
    });
  });

  describe('label', () => {
    test('returns human-readable labels', () => {
      expect(KeySelectionMode.manual().label).toBe('Manual');
      expect(KeySelectionMode.autoBalance('google').label).toBe(
        'Auto balance (round robin) GOOGLE',
      );
    });
  });
});
