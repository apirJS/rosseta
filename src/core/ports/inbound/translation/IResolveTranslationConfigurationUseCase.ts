import type { Credential } from '../../../domain/credential/Credential';
import type { CustomProviderConfig } from '../../../domain/provider/CustomProviderConfig';
import type { Language } from '../../../domain/translation/Language';
import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';

export interface ResolvedTranslationConfiguration {
  readonly credential: Credential;
  readonly modelId: string;
  readonly targetLanguage: Language;
  readonly includeDescription: boolean;
  readonly customProvider?: CustomProviderConfig;
}

export interface IResolveTranslationConfigurationUseCase {
  execute(): Promise<Result<ResolvedTranslationConfiguration, AppError>>;
}
