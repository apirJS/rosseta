import { KeySelectionMode } from '../../src/core/domain/credential/KeySelectionMode';
import type { AnyProvider } from '../../src/core/domain/credential/Provider';
import type { IKeySelectionStorage } from '../../src/core/ports/outbound/IKeySelectionStorage';
import { AppError } from '../../src/shared/errors';
import { failure, type Result, success } from '../../src/shared/types/Result';

export class FakeKeySelectionStorage implements IKeySelectionStorage {
  private selectionMode: KeySelectionMode = KeySelectionMode.manual();
  private lastUsedIdValues = new Map<string, string>();
  private injectedError: AppError | null = null;

  failNextCallWith(error: AppError): void {
    this.injectedError = error;
  }

  /** Seed the mode for testing. */
  seedMode(mode: KeySelectionMode): void {
    this.selectionMode = mode;
  }

  /** Seed a lastUsedId for testing. */
  seedLastUsedId(provider: string, id: string): void {
    this.lastUsedIdValues.set(provider, id);
  }

  private consumeError(): AppError | null {
    const e = this.injectedError;
    this.injectedError = null;
    return e;
  }

  async getMode(): Promise<Result<KeySelectionMode, AppError>> {
    const error = this.consumeError();
    if (error) return failure(error);
    return success(this.selectionMode);
  }

  async setMode(mode: KeySelectionMode): Promise<Result<void, AppError>> {
    const error = this.consumeError();
    if (error) return failure(error);
    this.selectionMode = mode;
    return success(undefined);
  }

  async getLastUsedId(
    provider: AnyProvider,
  ): Promise<Result<string | null, AppError>> {
    const error = this.consumeError();
    if (error) return failure(error);
    return success(this.lastUsedIdValues.get(provider) ?? null);
  }

  async setLastUsedId(
    provider: AnyProvider,
    credentialId: string,
  ): Promise<Result<void, AppError>> {
    const error = this.consumeError();
    if (error) return failure(error);
    this.lastUsedIdValues.set(provider, credentialId);
    return success(undefined);
  }

  async getAllLastUsedIds(): Promise<
    Result<Record<string, string>, AppError>
  > {
    const error = this.consumeError();
    if (error) return failure(error);
    return success(Object.fromEntries(this.lastUsedIdValues));
  }

  async replaceLastUsedIds(
    ids: Record<string, string>,
  ): Promise<Result<void, AppError>> {
    const error = this.consumeError();
    if (error) return failure(error);
    this.lastUsedIdValues = new Map(Object.entries(ids));
    return success(undefined);
  }
}
