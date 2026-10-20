import { describe, expect, test } from 'bun:test';
import { PROVIDERS } from '../credential/Provider';
import {
  BUILTIN_PROVIDER_DEFINITIONS,
  getProviderDefinition,
  getProviderDefaultModelId,
} from './provider-definitions';

describe('Domain: immutable provider definitions', () => {
  test('defines every built-in provider without runtime catalog state', () => {
    expect(Object.keys(BUILTIN_PROVIDER_DEFINITIONS).toSorted()).toEqual(
      [...PROVIDERS].toSorted(),
    );

    for (const id of PROVIDERS) {
      expect(getProviderDefinition(id)?.id).toBe(id);
      expect(getProviderDefinition(id)?.name).toBeTruthy();
      expect(getProviderDefinition(id)).not.toHaveProperty('models');
    }
  });

  test('retains existing default hints', () => {
    expect(getProviderDefaultModelId('google')).toBe('gemini-2.5-flash');
    expect(getProviderDefaultModelId('deepseek')).toBe('deepseek-flash');

    expect(getProviderDefaultModelId('nvidia')).toBe(
      'meta/llama-3.2-11b-vision-instruct',
    );

    expect(getProviderDefaultModelId('puter')).toBe('');
  });

  test('does not register custom or unknown provider state', () => {
    expect(getProviderDefinition('custom-endpoint')).toBeUndefined();
    expect(getProviderDefaultModelId('custom-endpoint')).toBe('');
    expect(getProviderDefinition('nonexistent')).toBeUndefined();
  });

  test('protects both the definitions collection and each entry from mutation', () => {
    expect(Object.isFrozen(BUILTIN_PROVIDER_DEFINITIONS)).toBe(true);
    for (const entry of Object.values(BUILTIN_PROVIDER_DEFINITIONS))
      expect(Object.isFrozen(entry)).toBe(true);
  });
});
