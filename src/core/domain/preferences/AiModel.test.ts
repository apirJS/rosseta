import { describe, expect, test } from 'bun:test';
import { AiModel } from './AiModel';
import { DomainError } from '../shared/DomainError';

describe('Domain: AiModel', () => {
  // ==================== CREATE ====================
  describe('create', () => {
    test('creates a known Gemini model', () => {
      const model = AiModel.create('gemini-2.5-flash');
      expect(model.id).toBe('gemini-2.5-flash');
      expect(model.name).toBe('Gemini 2.5 Flash');
      expect(model.provider).toBe('gemini');
    });

    test('creates a known Groq model', () => {
      const model = AiModel.create('meta-llama/llama-4-scout-17b-16e-instruct');
      expect(model.provider).toBe('groq');
      expect(model.name).toBe('Llama 4 Scout');
    });

    test('throws for unknown model ID', () => {
      expect(() => AiModel.create('made-up-model')).toThrow('Unknown model');
    });
  });

  // ==================== FROM RAW ====================
  describe('fromRaw', () => {
    test('accepts valid model ID string', () => {
      const result = AiModel.fromRaw('gemini-2.5-flash');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('gemini-2.5-flash');
      }
    });

    test('trims whitespace', () => {
      const result = AiModel.fromRaw('  gemini-2.5-flash  ');
      expect(result.success).toBe(true);
    });

    test('rejects empty string', () => {
      const result = AiModel.fromRaw('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
        expect(result.error.message).toContain('non-empty');
      }
    });

    test('rejects unknown model ID', () => {
      const result = AiModel.fromRaw('gpt-4');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Unknown model');
      }
    });
  });

  // ==================== EQUALITY ====================
  describe('equality', () => {
    test('same models are equal', () => {
      const a = AiModel.create('gemini-2.5-flash');
      const b = AiModel.create('gemini-2.5-flash');
      expect(a.equals(b)).toBe(true);
    });

    test('different models are not equal', () => {
      const a = AiModel.create('gemini-2.5-flash');
      const b = AiModel.create('gemini-2.0-flash');
      expect(a.equals(b)).toBe(false);
    });
  });
});
