import { describe, expect, test } from 'bun:test';
import { UserPreferences } from './UserPreferences';
import { Theme } from './Theme';
import { Language } from '../translation/Language';
import { DomainError } from '../shared/DomainError';

describe('Domain: UserPreferences', () => {
  describe('createDefault', () => {
    test('creates with sensible defaults', () => {
      const prefs = UserPreferences.createDefault('prefs-1');
      expect(prefs.id).toBe('prefs-1');
      expect(prefs.theme.value).toBe('system');
      expect(prefs.targetLanguage.code).toBe('en-US');
      expect(prefs.selectedModels).toEqual({});
      expect(prefs.shortcut).toBeNull();
    });
  });

  describe('getModelIdFor', () => {
    test('returns the saved model for the provider', () => {
      const prefs = UserPreferences.fromRaw({
        id: 'prefs-1',
        selectedModels: { google: 'gemini-2.0-flash' },
      });
      expect(prefs.success && prefs.data.getModelIdFor('google')).toBe(
        'gemini-2.0-flash',
      );
    });

    test('falls back to the provider default when nothing is saved', () => {
      const prefs = UserPreferences.createDefault('prefs-1');
      expect(prefs.getModelIdFor('google')).toBe('gemini-2.5-flash');
      expect(prefs.getModelIdFor('anthropic')).toBe(
        'claude-sonnet-4-20250514',
      );
    });

    test('returns empty string for providers without a default', () => {
      const prefs = UserPreferences.createDefault('prefs-1');
      expect(prefs.getModelIdFor('custom-unknown')).toBe('');
      expect(prefs.hasSelectedModel('custom-unknown')).toBe(false);
    });

    test('hasSelectedModel is true when a model resolves', () => {
      const prefs = UserPreferences.createDefault('prefs-1');
      expect(prefs.hasSelectedModel('google')).toBe(true);
    });
  });

  describe('fromRaw', () => {
    test('accepts valid raw props', () => {
      const result = UserPreferences.fromRaw({
        id: 'prefs-1',
        theme: 'dark',
        targetLanguage: 'ja-JP',
        selectedModels: { google: 'gemini-2.0-flash', groq: 'llama-4' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.theme.isDark).toBe(true);
        expect(result.data.targetLanguage.code).toBe('ja-JP');
        expect(result.data.selectedModels).toEqual({
          google: 'gemini-2.0-flash',
          groq: 'llama-4',
        });
      }
    });

    test('uses defaults for missing fields', () => {
      const result = UserPreferences.fromRaw({ id: 'prefs-1' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.theme.value).toBe('system');
        expect(result.data.targetLanguage.code).toBe('en-US');
        expect(result.data.selectedModels).toEqual({});
      }
    });

    test('drops invalid selectedModels entries instead of failing', () => {
      const result = UserPreferences.fromRaw({
        id: 'prefs-1',
        selectedModels: {
          google: 'gemini-2.0-flash',
          groq: '',
          xai: 42,
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedModels).toEqual({
          google: 'gemini-2.0-flash',
        });
      }
    });

    test('ignores legacy selectedModel', () => {
      const result = UserPreferences.fromRaw({
        id: 'prefs-1',
        selectedModel: 'gpt-4o',
      } as Parameters<typeof UserPreferences.fromRaw>[0]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedModels).toEqual({});
      }
    });

    test('fails on missing ID', () => {
      const result = UserPreferences.fromRaw({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
        expect(result.error.message).toContain('ID');
      }
    });

    test('fails on invalid theme', () => {
      const result = UserPreferences.fromRaw({
        id: 'prefs-1',
        theme: 'neon',
      });
      expect(result.success).toBe(false);
    });

    test('fails on invalid language', () => {
      const result = UserPreferences.fromRaw({
        id: 'prefs-1',
        targetLanguage: 'xx-FAKE',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('with* methods', () => {
    test('withTheme returns new preferences with updated theme', () => {
      const prefs = UserPreferences.createDefault('prefs-1');
      const updated = prefs.withTheme(Theme.create('dark'));
      expect(updated.theme.isDark).toBe(true);
      expect(updated.targetLanguage.code).toBe(prefs.targetLanguage.code);
      expect(prefs.theme.value).toBe('system');
    });

    test('withTargetLanguage returns new preferences with updated language', () => {
      const prefs = UserPreferences.createDefault('prefs-1');
      const updated = prefs.withTargetLanguage(Language.create('ja-JP'));
      expect(updated.targetLanguage.code).toBe('ja-JP');
      expect(prefs.targetLanguage.code).toBe('en-US');
    });

    test('withSelectedModel updates only that provider', () => {
      const prefs = UserPreferences.fromRaw({
        id: 'prefs-1',
        selectedModels: { google: 'gemini-2.0-flash' },
      });
      expect(prefs.success).toBe(true);
      if (!prefs.success) return;

      const updated = prefs.data.withSelectedModel('groq', 'llama-4');
      expect(updated.selectedModels).toEqual({
        google: 'gemini-2.0-flash',
        groq: 'llama-4',
      });
      expect(updated.getModelIdFor('groq')).toBe('llama-4');
      expect(prefs.data.selectedModels).toEqual({
        google: 'gemini-2.0-flash',
      });
    });
  });

  describe('toProps round-trip', () => {
    test('round-trips through fromRaw', () => {
      const prefs = UserPreferences.createDefault('prefs-1')
        .withTargetLanguage(Language.create('ja-JP'))
        .withSelectedModel('xai', 'grok-3');
      const props = prefs.toProps();

      const result = UserPreferences.fromRaw(props);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.targetLanguage.code).toBe('ja-JP');
        expect(result.data.selectedModels).toEqual({ xai: 'grok-3' });
      }
    });
  });
});
