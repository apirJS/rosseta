import { describe, expect, test } from 'bun:test';
import { Theme } from './Theme';
import { DomainError } from '../shared/DomainError';

describe('Domain: Theme', () => {
  // ==================== FACTORY METHODS ====================
  describe('static factories', () => {
    test('system() creates system theme', () => {
      const theme = Theme.system();
      expect(theme.value).toBe('system');
      expect(theme.isSystem).toBe(true);
      expect(theme.isDark).toBe(false);
      expect(theme.isLight).toBe(false);
    });

    test('dark() creates dark theme', () => {
      const theme = Theme.dark();
      expect(theme.value).toBe('dark');
      expect(theme.isDark).toBe(true);
      expect(theme.isSystem).toBe(false);
      expect(theme.isLight).toBe(false);
    });

    test('light() creates light theme', () => {
      const theme = Theme.light();
      expect(theme.value).toBe('light');
      expect(theme.isLight).toBe(true);
      expect(theme.isDark).toBe(false);
      expect(theme.isSystem).toBe(false);
    });
  });

  // ==================== CREATE ====================
  describe('create', () => {
    test('creates from known ThemeValue', () => {
      expect(Theme.create('dark').value).toBe('dark');
      expect(Theme.create('light').value).toBe('light');
      expect(Theme.create('system').value).toBe('system');
    });
  });

  // ==================== FROM RAW ====================
  describe('fromRaw', () => {
    test('accepts valid theme strings', () => {
      for (const val of ['dark', 'light', 'system'] as const) {
        const result = Theme.fromRaw(val);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.value).toBe(val);
      }
    });

    test('rejects empty string', () => {
      const result = Theme.fromRaw('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
      }
    });

    test('rejects invalid theme value', () => {
      const result = Theme.fromRaw('auto');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid theme');
      }
    });
  });

  // ==================== EQUALITY ====================
  describe('equality', () => {
    test('same themes are equal', () => {
      expect(Theme.dark().equals(Theme.dark())).toBe(true);
    });

    test('different themes are not equal', () => {
      expect(Theme.dark().equals(Theme.light())).toBe(false);
    });
  });
});
