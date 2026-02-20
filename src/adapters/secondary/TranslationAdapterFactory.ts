import type { ITranslationService } from '../../core/ports/outbound/ITranslationService';
import type { Credential } from '../../core/domain/credential/Credential';
import type { UserPreferences } from '../../core/domain/preferences/UserPreferences';
import { GeminiTranslationAdapter } from './gemini/GeminiTranslationAdapter';
import { GroqTranslationAdapter } from './groq/GroqTranslationAdapter';

export function createTranslationAdapter(
  credential: Credential,
  preferences: UserPreferences,
): ITranslationService {
  switch (credential.provider) {
    case 'gemini':
      return new GeminiTranslationAdapter(credential, preferences);
    case 'groq':
      return new GroqTranslationAdapter(credential, preferences);
  }
}
