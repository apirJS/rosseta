import { describe, expect, test } from 'bun:test';
import { createTranslationAdapter } from './TranslationAdapterFactory';
import { GeminiTranslationAdapter } from './gemini/GeminiTranslationAdapter';
import { GroqTranslationAdapter } from './groq/GroqTranslationAdapter';
import { Credential } from '../../core/domain/credential/Credential';
import { UserPreferences } from '../../core/domain/preferences/UserPreferences';
import { ApiKey } from '../../core/domain/credential/ApiKey';
import { v4 as uuidv4 } from 'uuid';

// ── Helpers ──────────────────────────────────────────────────────────

function createCredential(provider: 'gemini' | 'groq') {
  const key =
    provider === 'gemini'
      ? 'AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
      : 'gsk_validGroqKey12345678901234567890';

  const apiKey = ApiKey.create(key);
  if (!apiKey.success) throw new Error('bad key');

  const cred = Credential.create(uuidv4(), apiKey.data, provider);
  if (!cred.success) throw new Error('bad cred');

  return cred.data;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Adapter: TranslationAdapterFactory', () => {
  const preferences = UserPreferences.createDefault(uuidv4());

  test('returns GeminiTranslationAdapter for gemini provider', () => {
    const adapter = createTranslationAdapter(
      createCredential('gemini'),
      preferences,
    );
    expect(adapter).toBeInstanceOf(GeminiTranslationAdapter);
  });

  test('returns GroqTranslationAdapter for groq provider', () => {
    const adapter = createTranslationAdapter(
      createCredential('groq'),
      preferences,
    );
    expect(adapter).toBeInstanceOf(GroqTranslationAdapter);
  });
});
