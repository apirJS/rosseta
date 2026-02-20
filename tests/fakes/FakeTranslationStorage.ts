import type { ITranslationStorage } from '../../src/core/ports/outbound/ITranslationStorage';
import type { Translation } from '../../src/core/domain/translation/Translation';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';

export class FakeTranslationStorage implements ITranslationStorage {
  private _storage: Map<string, Translation> = new Map();
  private _error: AppError | null = null;

  /** Seed the fake with a pre-existing translation */
  seed(translation: Translation): void {
    this._storage.set(translation.id, translation);
  }

  /** Make the next call fail once with the given error */
  failNextCallWith(error: AppError): void {
    this._error = error;
  }

  get storedCount(): number {
    return this._storage.size;
  }

  async save(translation: Translation): Promise<Result<void, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }
    this._storage.set(translation.id, translation);
    return success(undefined);
  }

  async getById(id: string): Promise<Result<Translation | null, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }
    return success(this._storage.get(id) ?? null);
  }

  async getAll(): Promise<Result<Translation[], AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }
    return success([...this._storage.values()]);
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }
    this._storage.delete(id);
    return success(undefined);
  }

  async clear(): Promise<Result<void, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }
    this._storage.clear();
    return success(undefined);
  }
}
