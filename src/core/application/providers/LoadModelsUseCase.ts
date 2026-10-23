import type { ILoadModelsUseCase } from '../../ports/inbound/providers/ILoadModelsUseCase';
import type {
  IModelStorage,
  StoredModel,
} from '../../ports/outbound/IModelStorage';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class LoadModelsUseCase implements ILoadModelsUseCase {
  constructor(private readonly modelStorage: IModelStorage) {}

  async execute(provider: string): Promise<Result<StoredModel[], AppError>> {
    return this.modelStorage.getModels(provider);
  }

  async executeAll(): Promise<Result<Record<string, StoredModel[]>, AppError>> {
    return this.modelStorage.getAllModels();
  }
}
