import type { Credential } from '../../../core/domain/credential/Credential';
import type { CustomProviderConfig } from '../../../core/domain/provider/CustomProviderConfig';
import type { TranslationProviderContext } from '../translation/transports/GenerationTransport';

export type { ProviderRuntime } from '../translation/transports/GenerationTransport';

import { providerProtocol } from '../translation/compatibility/translation-capability-key';

export interface ProviderRuntimeInput {
  readonly credential: Credential;
  readonly modelId: string;
  readonly customProviderConfig?: CustomProviderConfig;
}

export interface CustomProviderRuntimeInput extends ProviderRuntimeInput {
  readonly customProviderConfig: CustomProviderConfig;
}

/** Preserve provider/model/endpoint identity independently of SDK construction. */
export function createProviderContext(
  input: ProviderRuntimeInput,
  legacyUnambiguous: boolean,
): TranslationProviderContext {
  return {
    providerId: input.credential.provider,
    modelId: input.modelId,
    protocol: providerProtocol(
      input.credential.provider,
      input.customProviderConfig,
    ),
    ...(input.customProviderConfig
      ? { customConfig: input.customProviderConfig }
      : {}),
    ...(legacyUnambiguous ? { legacyUnambiguous: true } : {}),
  };
}
