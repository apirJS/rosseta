import { KeySelectionMode } from '../../src/core/domain/credential/KeySelectionMode';
import type { Provider } from '../../src/core/domain/credential/Provider';
import type { IKeySelectionStorage } from '../../src/core/ports/outbound/IKeySelectionStorage';
import { AppError } from '../../src/shared/errors';
import { failure, type Result, success } from '../../src/shared/types/Result';

export class FakeKeySelectionStorage implements IKeySelectionStorage {
  private _mode: KeySelectionMode = KeySelectionMode.manual();
  private _lastUsedIds = new Map<Provider, string>();
  private _error: AppError | null = null;

  failNextCallWith(error: AppError): void {
    this._error = error;
  }

  /** Seed the mode for testing. */
  seedMode(mode: KeySelectionMode): void {
    this._mode = mode;
  }

  /** Seed a lastUsedId for testing. */
  seedLastUsedId(provider: Provider, id: string): void {
    this._lastUsedIds.set(provider, id);
  }

  private consumeError(): AppError | null {
    const e = this._error;
    this._error = null;
    return e;
  }

  async getMode(): Promise<Result<KeySelectionMode, AppError>> {
    const error = this.consumeError();
    if (error) return failure(error);
    return success(this._mode);
  }

  async setMode(mode: KeySelectionMode): Promise<Result<void, AppError>> {
    const error = this.consumeError();
    if (error) return failure(error);
    this._mode = mode;
    return success(undefined);
  }

  async getLastUsedId(
    provider: Provider,
  ): Promise<Result<string | null, AppError>> {
    const error = this.consumeError();
    if (error) return failure(error);
    return success(this._lastUsedIds.get(provider) ?? null);
  }

  async setLastUsedId(
    provider: Provider,
    credentialId: string,
  ): Promise<Result<void, AppError>> {
    const error = this.consumeError();
    if (error) return failure(error);
    this._lastUsedIds.set(provider, credentialId);
    return success(undefined);
  }
}
