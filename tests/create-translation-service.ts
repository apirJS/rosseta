import type { Credential } from '../src/core/domain/credential/Credential';
import type { UserPreferences } from '../src/core/domain/preferences/UserPreferences';
import type { CustomProviderConfig } from '../src/core/domain/provider/CustomProviderConfig';
import type { ITranslationCapabilityStorage } from '../src/core/ports/outbound/ITranslationCapabilityStorage';
import { createTranslationService } from '../src/adapters/secondary/providers/create-provider-runtime';

/** Keep preference fixture setup out of the production snapshot-based construction API. */
export function createTranslationAdapter(
  credential: Credential,
  preferences: UserPreferences,
  customProviderConfig: CustomProviderConfig | undefined,
  capabilities: ITranslationCapabilityStorage,
) {
  return createTranslationService(
    {
      credential,
      modelId: preferences.getModelIdFor(credential.provider),
      includeDescription: preferences.includeDescription,
      customProviderConfig,
    },
    capabilities,
  );
}
