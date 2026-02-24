import { describe, expect, test } from 'bun:test';
import { ProviderRegistry } from './ProviderRegistry';
import { AiModel } from '../preferences/AiModel';

describe('Domain: ProviderRegistry', () => {
  // ==================== GET CONFIG ====================
  describe('getConfig', () => {
    test('returns config for gemini', () => {
      const config = ProviderRegistry.getConfig('gemini');
      expect(config.id).toBe('gemini');
      expect(config.name).toBe('Gemini');
      expect(config.models.length).toBeGreaterThan(0);
    });

    test('returns config for groq', () => {
      const config = ProviderRegistry.getConfig('groq');
      expect(config.id).toBe('groq');
      expect(config.name).toBe('Groq');
      expect(config.models.length).toBeGreaterThan(0);
    });
  });

  // ==================== GET DEFAULT MODEL ====================
  describe('getDefaultModelId', () => {
    test('gemini default is gemini-2.5-flash-lite', () => {
      expect(ProviderRegistry.getDefaultModelId('gemini')).toBe(
        'gemini-2.5-flash-lite',
      );
    });

    test('groq default is llama-4-maverick', () => {
      expect(ProviderRegistry.getDefaultModelId('groq')).toBe(
        'meta-llama/llama-4-maverick-17b-128e-instruct',
      );
    });

    test('default model ID is valid and can create AiModel', () => {
      const geminiId = ProviderRegistry.getDefaultModelId('gemini');
      const groqId = ProviderRegistry.getDefaultModelId('groq');

      const geminiModel = AiModel.create(geminiId);
      expect(geminiModel.provider).toBe('gemini');

      const groqModel = AiModel.create(groqId);
      expect(groqModel.provider).toBe('groq');
    });
  });

  // ==================== GET MODELS FOR PROVIDER ====================
  describe('getModelsForProvider', () => {
    test('returns only Gemini models', () => {
      const models = ProviderRegistry.getModelsForProvider('gemini');
      expect(models.length).toBeGreaterThan(0);
      for (const m of models) {
        const model = AiModel.create(m.id);
        expect(model.provider).toBe('gemini');
      }
    });

    test('returns only Groq models', () => {
      const models = ProviderRegistry.getModelsForProvider('groq');
      expect(models.length).toBeGreaterThan(0);
      for (const m of models) {
        const model = AiModel.create(m.id);
        expect(model.provider).toBe('groq');
      }
    });
  });

  // ==================== GET SUPPORTED LANGUAGES ====================
  describe('getSupportedLanguages', () => {
    test('gemini supports many languages', () => {
      const langs = ProviderRegistry.getSupportedLanguages('gemini');
      expect(langs.length).toBeGreaterThan(30);
      expect(langs).toContain('en-US');
      expect(langs).toContain('ja-JP');
    });

    test('groq supports fewer languages', () => {
      const langs = ProviderRegistry.getSupportedLanguages('groq');
      expect(langs.length).toBeGreaterThan(0);
      expect(langs.length).toBeLessThan(
        ProviderRegistry.getSupportedLanguages('gemini').length,
      );
      expect(langs).toContain('en-US');
    });
  });

  // ==================== GET ALL MODEL ENTRIES ====================
  describe('getAllModelEntries', () => {
    test('contains models from all providers', () => {
      const entries = ProviderRegistry.getAllModelEntries();
      const ids = Object.keys(entries);
      expect(ids.length).toBeGreaterThan(0);

      const providers = new Set(Object.values(entries).map((e) => e.provider));
      expect(providers.has('gemini')).toBe(true);
      expect(providers.has('groq')).toBe(true);
    });
  });
});
