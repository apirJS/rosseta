import type { IModelStorage, StoredModel } from '../../src/core/ports/outbound/IModelStorage';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';
import { StorageError } from '../../src/shared/errors';

export class FakeModelStorage implements IModelStorage {
  private store = new Map<string, StoredModel[]>();
  private _failNext: AppError | null = null;

  async getModels(provider: string): Promise<Result<StoredModel[], AppError>> {
    if (this._failNext) {
      const err = this._failNext;
      this._failNext = null;
      return failure(err);
    }
    return success(this.store.get(provider) ?? []);
  }

  async getAllModels(): Promise<
    Result<Record<string, StoredModel[]>, AppError>
  > {
    if (this._failNext) {
      const err = this._failNext;
      this._failNext = null;
      return failure(err);
    }
    const byProvider: Record<string, StoredModel[]> = {};
    for (const [provider, models] of this.store) {
      byProvider[provider] = [...models];
    }
    return success(byProvider);
  }

  async setModels(
    provider: string,
    models: StoredModel[],
  ): Promise<Result<void, AppError>> {
    if (this._failNext) {
      const err = this._failNext;
      this._failNext = null;
      return failure(err);
    }
    this.store.set(provider, models);
    return success(undefined);
  }

  async clearModels(provider: string): Promise<Result<void, AppError>> {
    if (this._failNext) {
      const err = this._failNext;
      this._failNext = null;
      return failure(err);
    }
    this.store.delete(provider);
    return success(undefined);
  }

  // ── Test helpers ──
  seedModels(provider: string, models: StoredModel[]): void {
    this.store.set(provider, models);
  }

  failNextCallWith(error: AppError): void {
    this._failNext = error;
  }

  getStoredModels(provider: string): StoredModel[] {
    return this.store.get(provider) ?? [];
  }
}
