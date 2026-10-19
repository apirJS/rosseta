import type { IResetProviderCapabilitiesUseCase } from '../../ports/inbound/models/IResetProviderCapabilitiesUseCase';
import type { ITranslationCapabilityStorage } from '../../ports/outbound/ITranslationCapabilityStorage';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

/** Reset one opaque provider namespace without fetching models or generating output. */
export class ResetProviderCapabilitiesUseCase implements IResetProviderCapabilitiesUseCase {
  constructor(private readonly storage: ITranslationCapabilityStorage) {}

  execute(namespace: string): Promise<Result<void, AppError>> {
    return this.storage.resetNamespace(namespace);
  }
}
