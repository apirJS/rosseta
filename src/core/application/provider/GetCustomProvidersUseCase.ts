import type { IGetCustomProvidersUseCase } from '../../ports/inbound/provider/IGetCustomProvidersUseCase';
import type { ICustomProviderStorage } from '../../ports/outbound/ICustomProviderStorage';
import type { CustomProviderConfig } from '../../domain/provider/CustomProviderConfig';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class GetCustomProvidersUseCase implements IGetCustomProvidersUseCase {
  constructor(private readonly storage: ICustomProviderStorage) {}

  async execute(): Promise<Result<CustomProviderConfig[], AppError>> {
    return this.storage.load();
  }
}
