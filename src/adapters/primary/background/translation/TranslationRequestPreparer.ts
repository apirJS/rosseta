import { TranslateImageUseCase } from '../../../../core/application/translation/TranslateImageUseCase';
import type { ITranslateImageUseCase } from '../../../../core/ports/inbound/translation/ITranslateImageUseCase';
import type { IResolveTranslationConfigurationUseCase } from '../../../../core/ports/inbound/translation/IResolveTranslationConfigurationUseCase';
import type { ITranslationService } from '../../../../core/ports/outbound/ITranslationService';
import type { ResolvedTranslationConfiguration } from '../../../../core/ports/inbound/translation/IResolveTranslationConfigurationUseCase';
import type { AppError } from '../../../../shared/errors';
import { success, type Result } from '../../../../shared/types/Result';

export interface PreparedTranslationRequest {
  useCase: ITranslateImageUseCase;
  targetLanguage: { code: string; name: string };
}

export interface ITranslationRequestPreparer {
  prepare(): Promise<Result<PreparedTranslationRequest, AppError>>;
}

export interface TranslationRequestPreparerDeps {
  resolveTranslationConfigurationUseCase: IResolveTranslationConfigurationUseCase;
  createService(config: ResolvedTranslationConfiguration): ITranslationService;
}

/** Bind one resolved domain snapshot to the provider adapter. */
export class TranslationRequestPreparer implements ITranslationRequestPreparer {
  constructor(private readonly deps: TranslationRequestPreparerDeps) {}

  async prepare(): Promise<Result<PreparedTranslationRequest, AppError>> {
    const resolved =
      await this.deps.resolveTranslationConfigurationUseCase.execute();

    if (!resolved.success) return resolved;

    const config = resolved.data;
    const service = this.deps.createService(config);

    return success({
      useCase: new TranslateImageUseCase(service),
      targetLanguage: {
        code: config.targetLanguage.code,
        name: config.targetLanguage.name,
      },
    });
  }
}
