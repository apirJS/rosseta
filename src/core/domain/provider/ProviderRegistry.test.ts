import { describe, expect, test } from 'bun:test';
import { ProviderRegistry } from './ProviderRegistry';

describe('Domain: ProviderRegistry', () => {
  describe('getConfig', () => {
    test('returns config for google', () => {
      const config = ProviderRegistry.getConfig('google');
      expect(config.id).toBe('google');
      expect(config.name).toBe('Google');
    });

    test('returns config for groq', () => {
      const config = ProviderRegistry.getConfig('groq');
      expect(config.id).toBe('groq');
      expect(config.name).toBe('Groq');
    });

    test('throws for unknown provider', () => {
      expect(() => ProviderRegistry.getConfig('nonexistent')).toThrow('Unknown provider');
    });
  });

  describe('getDefaultModelId', () => {
    test('google default is gemini-2.5-flash', () => {
      expect(ProviderRegistry.getDefaultModelId('google')).toBe(
        'gemini-2.5-flash',
      );
    });

    test('groq default is llama-4-scout', () => {
      expect(ProviderRegistry.getDefaultModelId('groq')).toBe(
        'meta-llama/llama-4-scout-17b-16e-instruct',
      );
    });
  });

  describe('dynamic model management', () => {
    test('models start empty for providers', () => {
      ProviderRegistry.setModels('google', []);
      const models = ProviderRegistry.getModelsForProvider('google');
      expect(models).toHaveLength(0);
    });

    test('setModels populates model list', () => {
      ProviderRegistry.setModels('google', [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      ]);

      const models = ProviderRegistry.getModelsForProvider('google');
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('gemini-2.5-flash');

      ProviderRegistry.setModels('google', []);
    });

    test('addModel adds without duplicates', () => {
      ProviderRegistry.setModels('groq', []);
      ProviderRegistry.addModel('groq', { id: 'model-a', name: 'Model A' });
      ProviderRegistry.addModel('groq', { id: 'model-a', name: 'Model A' });

      const models = ProviderRegistry.getModelsForProvider('groq');
      expect(models).toHaveLength(1);

      ProviderRegistry.setModels('groq', []);
    });

    test('removeModel removes by ID', () => {
      ProviderRegistry.setModels('groq', [
        { id: 'model-a', name: 'Model A' },
        { id: 'model-b', name: 'Model B' },
      ]);
      ProviderRegistry.removeModel('groq', 'model-a');

      const models = ProviderRegistry.getModelsForProvider('groq');
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('model-b');

      ProviderRegistry.setModels('groq', []);
    });
  });

  describe('getAllModelEntries', () => {
    test('returns entries from populated providers', () => {
      ProviderRegistry.setModels('google', [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      ]);
      ProviderRegistry.setModels('groq', [
        { id: 'llama-model', name: 'Llama Model' },
      ]);

      const entries = ProviderRegistry.getAllModelEntries();
      expect(entries['gemini-2.5-flash']).toBeDefined();
      expect(entries['gemini-2.5-flash'].provider).toBe('google');
      expect(entries['llama-model']).toBeDefined();
      expect(entries['llama-model'].provider).toBe('groq');

      ProviderRegistry.setModels('google', []);
      ProviderRegistry.setModels('groq', []);
    });
  });

  describe('getAllProviders', () => {
    test('returns configs for all registered providers', () => {
      const providers = ProviderRegistry.getAllProviders();
      expect(providers.map((p) => p.id).sort()).toEqual([
        'anthropic',
        'deepinfra',
        'google',
        'groq',
        'huggingface',
        'mistral',
        'openai',
        'opencode',
        'openrouter',
        'xai',
        'zai',
      ]);
    });
  });

  describe('syncCustomProviders', () => {
    test('registers custom providers and unregisters removed ones', () => {
      ProviderRegistry.syncCustomProviders([
        { id: 'custom-a', name: 'Provider A' },
        { id: 'custom-b', name: 'Provider B' },
      ]);

      expect(ProviderRegistry.getConfig('custom-a').name).toBe('Provider A');
      expect(ProviderRegistry.getDefaultModelId('custom-a')).toBe('');

      ProviderRegistry.syncCustomProviders([{ id: 'custom-a', name: 'A2' }]);

      expect(() => ProviderRegistry.getConfig('custom-b')).toThrow();
      expect(ProviderRegistry.getConfig('custom-a').name).toBe('A2');

      ProviderRegistry.syncCustomProviders([]);
      expect(() => ProviderRegistry.getConfig('custom-a')).toThrow();
    });

    test('never removes builtin providers', () => {
      ProviderRegistry.syncCustomProviders([
        { id: 'google', name: 'Fake Google' },
      ]);

      expect(ProviderRegistry.getConfig('google').name).toBe('Google');
    });
  });

  describe('getDefaultModelId', () => {
    test('returns empty string for unknown providers', () => {
      expect(ProviderRegistry.getDefaultModelId('custom-unknown')).toBe('');
    });
  });

  describe('defensive copies and cache', () => {
    test('getModelsForProvider returns a copy that cannot mutate the registry', () => {
      ProviderRegistry.setModels('google', [{ id: 'copy-test', name: 'Copy Test' }]);

      const models = ProviderRegistry.getModelsForProvider('google');
      models.push({ id: 'injected', name: 'Injected' });

      expect(ProviderRegistry.getModelsForProvider('google')).toHaveLength(1);

      ProviderRegistry.setModels('google', []);
    });

    test('getAllModelEntries reflects mutations (cache invalidation)', () => {
      ProviderRegistry.setModels('groq', [
        { id: 'cache-test', name: 'Cache Test' },
      ]);
      expect(ProviderRegistry.getAllModelEntries()['cache-test']).toBeDefined();

      ProviderRegistry.removeModel('groq', 'cache-test');
      expect(ProviderRegistry.getAllModelEntries()['cache-test']).toBeUndefined();
    });
  });
});
