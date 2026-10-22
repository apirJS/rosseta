/** Provider connection defaults shared by runtime construction, catalogs and identity. */
export const PROVIDER_ENDPOINTS: Readonly<Record<string, string>> = {
  google: 'https://generativelanguage.googleapis.com/v1beta',
  groq: 'https://api.groq.com/openai/v1',
  xai: 'https://api.x.ai/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  deepinfra: 'https://api.deepinfra.com/v1/openai',
  deepseek: 'https://api.deepseek.com',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  zai: 'https://api.z.ai/api/paas/v4',
  openrouter: 'https://openrouter.ai/api/v1',
  opencode: 'https://opencode.ai/zen/v1',
  huggingface: 'https://router.huggingface.co/v1',
  puter: 'https://api.puter.com/drivers/call',
};

export function providerProtocol(
  providerId: string,
  customConfig?: { type?: string },
): string {
  if (customConfig?.type === 'anthropic' || providerId === 'anthropic')
    return 'anthropic';
  if (providerId === 'google') return 'google';
  if (providerId === 'puter') return 'puter-native';
  if (providerId === 'openai') return 'openai-responses';

  return 'openai-compatible';
}
