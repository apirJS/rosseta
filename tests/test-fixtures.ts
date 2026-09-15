import { v4 as uuidv4 } from 'uuid';
import { ApiKey } from '../src/core/domain/credential/ApiKey';
import { Credential } from '../src/core/domain/credential/Credential';
import { Credentials } from '../src/core/domain/credential/Credentials';
import { UserPreferences } from '../src/core/domain/preferences/UserPreferences';
import { EncodedImage } from '../src/core/domain/image/EncodedImage';
import { Language } from '../src/core/domain/translation/Language';
import type { TranslationSchemaOutput } from '../src/adapters/secondary/shared/translation-schema';
import { seedStore } from './browser-mock';
import type { Provider } from '../src/core/domain/credential/Provider';

export const VALID_IMAGE_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVRQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVRQI12P4z8BQDwAEgAF/QualrQAAAABJRU5ErkJggg==';

export const VALID_IMAGE = (() => {
  const result = EncodedImage.create(VALID_IMAGE_BASE64);
  if (!result.success) throw new Error('Failed to create test image');
  return result.data;
})();

export const TARGET_LANGUAGE = Language.create('en-US');

export const VALID_TRANSLATION_RESPONSE: TranslationSchemaOutput = {
  success: true,
  error: null,
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

const GOOGLE_KEY = 'AIza' + 'X'.repeat(35);
const GROQ_KEY = 'gsk_' + 'X'.repeat(52);
const XAI_KEY = 'a'.repeat(32) + '.abcdefghijklmn';

function createCredentialFor(
  rawKey: string,
  provider: Provider,
): Credential {
  const apiKey = ApiKey.createWithProvider(rawKey, provider);
  if (!apiKey.success) throw apiKey.error;
  const credential = Credential.create(uuidv4(), apiKey.data, provider);
  if (!credential.success) throw credential.error;
  return credential.data;
}

export function createGoogleCredential(): Credential {
  return createCredentialFor(GOOGLE_KEY, 'google');
}

export function createGroqCredential(): Credential {
  return createCredentialFor(GROQ_KEY, 'groq');
}

export function createXaiCredential(): Credential {
  return createCredentialFor(XAI_KEY, 'xai');
}

export function createDefaultPreferences(): UserPreferences {
  return UserPreferences.createDefault(uuidv4());
}

export function seedCredentialsAndPreferences(
  provider: 'google' | 'groq' | 'xai' = 'groq',
) {
  const credentialFactories = {
    google: createGoogleCredential,
    groq: createGroqCredential,
    xai: createXaiCredential,
  };
  const credential = credentialFactories[provider]();

  const credentials = Credentials.createEmpty(uuidv4()).add(credential);
  const userPreferences = createDefaultPreferences();

  seedStore({
    credentials: credentials.toProps(),
    userPreferences: userPreferences.toProps(),
  });

  return { credentials, credential, userPreferences };
}
