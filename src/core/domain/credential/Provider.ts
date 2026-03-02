export type Provider = 'gemini' | 'groq' | 'zai';

export const PROVIDERS: Provider[] = ['gemini', 'groq', 'zai'];

export function detectProvider(rawKey: string): Provider | null {
  if (rawKey.startsWith('AIza')) return 'gemini';
  if (rawKey.startsWith('gsk_')) return 'groq';
  if (rawKey.split('.')[0].length === 32) return 'zai';
  return null;
}
