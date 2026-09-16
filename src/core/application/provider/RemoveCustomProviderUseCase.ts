import type { IRemoveCustomProviderUseCase } from '../../ports/inbound/provider/IRemoveCustomProviderUseCase';
import type { ICustomProviderStorage } from '../../ports/outbound/ICustomProviderStorage';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import type { IModelStorage } from '../../ports/outbound/IModelStorage';
import { failure, type Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class RemoveCustomProviderUseCase
  implements IRemoveCustomProviderUseCase
{
  constructor(
    private readonly storage: ICustomProviderStorage,
    private readonly credentialStorage: ICredentialStorage,
    private readonly modelStorage: IModelStorage,
  ) {}

  async execute(id: string): Promise<Result<void, AppError>> {
    const removeResult = await this.storage.remove(id);
    if (!removeResult.success) {
      return removeResult;
    }

    const credentialsResult = await this.credentialStorage.get();
    if (credentialsResult.success && credentialsResult.data) {
      const credentials = credentialsResult.data;
      for (const credential of credentials.getByProvider(id)) {
        const updated = credentials.remove(credential.id);
        const saveResult = await this.credentialStorage.save(updated);
        if (!saveResult.success) {
          return failure(saveResult.error);
        }
      }
    }

    const clearModelsResult = await this.modelStorage.clearModels(id);
    if (!clearModelsResult.success) {
      return failure(clearModelsResult.error);
    }

    return { success: true, data: undefined };
  }
}
