/**
 * Shared test fixtures used across adapter tests.
 *
 * Centralizes domain object factories, API response envelopes,
 * and mock storage seeding to avoid duplication.
 */
import { v4 as uuidv4 } from 'uuid';
import { ApiKey } from '../src/core/domain/credential/ApiKey';
import { Credential } from '../src/core/domain/credential/Credential';
import { Credentials } from '../src/core/domain/credential/Credentials';
import { UserPreferences } from '../src/core/domain/preferences/UserPreferences';
import { EncodedImage } from '../src/core/domain/image/EncodedImage';
import { Language } from '../src/core/domain/translation/Language';
import type { TranslationResponse } from '../src/adapters/secondary/gemini/schema';
import type { GroqTranslationResponse } from '../src/adapters/secondary/groq/schema';
import { seedStore } from './browser-mock';

// ── Constants ────────────────────────────────────────────────────────

/** A minimal valid 1×1 PNG as a data URL. */
export const VALID_IMAGE_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualrQAAAABJRU5ErkJggg==';

export const VALID_IMAGE = (() => {
  const result = EncodedImage.create(VALID_IMAGE_BASE64);
  if (!result.success) throw new Error('Failed to create test image');
  return result.data;
})();

export const TARGET_LANGUAGE = Language.create('en-US');

/**
 * A valid translation API response body.
 * Both Gemini and Groq use the same inner shape.
 */
export const VALID_TRANSLATION_RESPONSE: TranslationResponse &
  GroqTranslationResponse = {
  success: true,
  data: {
    description: 'A greeting in Japanese',
    originalText: {
      contents: [
        {
          languageBcp47Code: 'ja-JP',
          language: 'Japanese',
          romanization: 'konnichiwa',
          text: 'こんにちは',
        },
      ],
    },
    translatedText: {
      contents: [
        {
          languageBcp47Code: 'en-US',
          language: 'English',
          romanization: null,
          text: 'Hello',
        },
      ],
    },
  },
};

// ── API Envelope Wrappers ────────────────────────────────────────────

/** Wrap a TranslationResponse in the Gemini API envelope. */
export function geminiEnvelope(response: TranslationResponse): object {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(response) }],
        },
      },
    ],
  };
}

/** Wrap a GroqTranslationResponse in the OpenAI-compatible envelope. */
export function groqEnvelope(response: GroqTranslationResponse): object {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(response),
        },
      },
    ],
  };
}

// ── Credential & Preferences Factories ──────────────────────────────

const GEMINI_KEY = 'AIza' + 'X'.repeat(35);
const GROQ_KEY = 'gsk_' + 'X'.repeat(52);

export function createGeminiCredential(): Credential {
  const apiKey = ApiKey.create(GEMINI_KEY);
  if (!apiKey.success) throw apiKey.error;
  const credential = Credential.create(uuidv4(), apiKey.data, 'gemini');
  if (!credential.success) throw credential.error;
  return credential.data;
}

export function createGroqCredential(): Credential {
  const apiKey = ApiKey.create(GROQ_KEY);
  if (!apiKey.success) throw apiKey.error;
  const credential = Credential.create(uuidv4(), apiKey.data, 'groq');
  if (!credential.success) throw credential.error;
  return credential.data;
}

export function createDefaultPreferences(): UserPreferences {
  return UserPreferences.createDefault(uuidv4());
}

/**
 * Seeds the browser mock store with serialized credentials and preferences.
 * The credential is set as the active key.
 */
export function seedCredentialsAndPreferences(
  provider: 'gemini' | 'groq' = 'groq',
) {
  const credential =
    provider === 'gemini' ? createGeminiCredential() : createGroqCredential();

  const credentials = Credentials.createEmpty(uuidv4()).add(credential);
  const userPreferences = createDefaultPreferences();

  seedStore({
    credentials: credentials.toProps(),
    userPreferences: userPreferences.toProps(),
  });

  return { credentials, credential, userPreferences };
}
