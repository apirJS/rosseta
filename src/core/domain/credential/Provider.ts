export type Provider = 'gemini' | 'groq';

export const PROVIDERS: Provider[] = ['gemini', 'groq'];

export function detectProvider(rawKey: string): Provider | null {
  if (rawKey.startsWith('AIza')) return 'gemini';
  if (rawKey.startsWith('gsk_')) return 'groq';
  return null;
}
