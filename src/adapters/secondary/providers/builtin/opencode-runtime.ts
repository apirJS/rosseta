import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { v4 as uuidv4 } from 'uuid';
import {
  createProviderContext,
  type ProviderRuntimeInput,
  type ProviderRuntime,
} from '../ProviderRuntime';
import { createProviderSdkTransport } from '../thinking/create-sdk-transport';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/v1';
const OPENCODE_USER_AGENT = 'opencode/0.20.5';
const OPENCODE_SESSION_ID = uuidv4();

export function createOpenCodeRuntime(
  input: ProviderRuntimeInput,
): ProviderRuntime {
  const provider = createOpenAICompatible({
    name: 'OpenCode',
    baseURL: OPENCODE_BASE_URL,
    apiKey: input.credential.apiKey.value,
    supportsStructuredOutputs: true,
    headers: {
      'X-Session-ID': OPENCODE_SESSION_ID,
      'User-Agent': OPENCODE_USER_AGENT,
      'HTTP-Referer': 'https://opencode.ai/',
      'X-Title': 'opencode',
    },
  });

  const model = provider(input.modelId);

  return {
    transport: createProviderSdkTransport(model),
    context: createProviderContext(input, true),
  };
}
