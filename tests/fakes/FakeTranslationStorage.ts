import type { ITranslationStorage } from '../../src/core/ports/outbound/ITranslationStorage';
import type { Translation } from '../../src/core/domain/translation/Translation';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';

export class FakeTranslationStorage implements ITranslationStorage {
  private storageValue: Map<string, Translation> = new Map();
  private injectedError: AppError | null = null;

  /** Seed the fake with a pre-existing translation */
  seed(translation: Translation): void {
    this.storageValue.set(translation.id, translation);
  }

  /** Make the next call fail once with the given error */
  failNextCallWith(error: AppError): void {
    this.injectedError = error;
  }

  get storedCount(): number {
    return this.storageValue.size;
  }

  async save(translation: Translation): Promise<Result<void, AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }
    this.storageValue.set(translation.id, translation);
    return success(undefined);
  }

  async getById(id: string): Promise<Result<Translation | null, AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }
    return success(this.storageValue.get(id) ?? null);
  }

  async getAll(): Promise<Result<Translation[], AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }
    return success([...this.storageValue.values()]);
  }

  async replaceAll(
    translations: Translation[],
  ): Promise<Result<void, AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }
    this.storageValue = new Map(
      translations.map((translation) => [translation.id, translation]),
    );
    return success(undefined);
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }
    this.storageValue.delete(id);
    return success(undefined);
  }

  async clear(): Promise<Result<void, AppError>> {
    if (this.injectedError) {
      const error = this.injectedError;
      this.injectedError = null;
      return failure(error);
    }
    this.storageValue.clear();
    return success(undefined);
  }
}
