import { describe, expect, test } from 'bun:test';
import { UserPreferences } from './UserPreferences';
import { Theme } from './Theme';
import { AiModel } from './AiModel';
import { Language } from '../translation/Language';
import { DomainError } from '../shared/DomainError';

describe('Domain: UserPreferences', () => {
  // ==================== CREATE DEFAULT ====================
  describe('createDefault', () => {
    test('creates with sensible defaults', () => {
      const prefs = UserPreferences.createDefault('prefs-1');
      expect(prefs.id).toBe('prefs-1');
      expect(prefs.theme.value).toBe('system');
      expect(prefs.targetLanguage.code).toBe('en-US');
      expect(prefs.selectedModel.id).toBe('gemini-2.5-flash-lite');
    });
  });

  // ==================== FROM RAW ====================
  describe('fromRaw', () => {
    test('accepts valid raw props', () => {
      const result = UserPreferences.fromRaw({
        id: 'prefs-1',
        theme: 'dark',
        targetLanguage: 'ja-JP',
        selectedModel: 'gemini-2.0-flash',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.theme.isDark).toBe(true);
        expect(result.data.targetLanguage.code).toBe('ja-JP');
        expect(result.data.selectedModel.id).toBe('gemini-2.0-flash');
      }
    });

    test('uses defaults for missing fields', () => {
      const result = UserPreferences.fromRaw({ id: 'prefs-1' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.theme.value).toBe('system');
        expect(result.data.targetLanguage.code).toBe('en-US');
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

    test('fails on invalid model', () => {
      const result = UserPreferences.fromRaw({
        id: 'prefs-1',
        selectedModel: 'gpt-4-turbo',
      });
      expect(result.success).toBe(false);
    });
  });

  // ==================== WITH* IMMUTABLE UPDATES ====================
  describe('immutable updates', () => {
    test('withTheme returns new instance with updated theme', () => {
      const original = UserPreferences.createDefault('prefs-1');
      const updated = original.withTheme(Theme.dark());

      expect(updated.theme.isDark).toBe(true);
      expect(original.theme.isSystem).toBe(true); // original unchanged
      expect(updated.targetLanguage.code).toBe(original.targetLanguage.code);
      expect(updated.selectedModel.id).toBe(original.selectedModel.id);
    });

    test('withTargetLanguage returns new instance', () => {
      const original = UserPreferences.createDefault('prefs-1');
      const updated = original.withTargetLanguage(Language.create('ko-KR'));

      expect(updated.targetLanguage.code).toBe('ko-KR');
      expect(original.targetLanguage.code).toBe('en-US');
    });

    test('withSelectedModel returns new instance', () => {
      const original = UserPreferences.createDefault('prefs-1');
      const updated = original.withSelectedModel(
        AiModel.create('gemini-2.0-flash'),
      );

      expect(updated.selectedModel.id).toBe('gemini-2.0-flash');
      expect(original.selectedModel.id).toBe('gemini-2.5-flash-lite');
    });
  });

  // ==================== TO PROPS ROUND TRIP ====================
  describe('toProps', () => {
    test('round-trips through toProps and fromRaw', () => {
      const original = UserPreferences.createDefault('prefs-1')
        .withTheme(Theme.dark())
        .withTargetLanguage(Language.create('ja-JP'));

      const props = original.toProps();
      expect(props).toEqual({
        id: 'prefs-1',
        theme: 'dark',
        targetLanguage: 'ja-JP',
        selectedModel: 'gemini-2.5-flash-lite',
      });

      const restored = UserPreferences.fromRaw(props);
      expect(restored.success).toBe(true);
      if (restored.success) {
        expect(restored.data.theme.isDark).toBe(true);
        expect(restored.data.targetLanguage.code).toBe('ja-JP');
      }
    });
  });
});
