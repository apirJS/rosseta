import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';
import type { KeySelectionMode } from '../../domain/credential/KeySelectionMode';
import type { Provider } from '../../domain/credential/Provider';

export interface IKeySelectionStorage {
  getMode(): Promise<Result<KeySelectionMode, AppError>>;
  setMode(mode: KeySelectionMode): Promise<Result<void, AppError>>;
  getLastUsedId(provider: Provider): Promise<Result<string | null, AppError>>;
  setLastUsedId(
    provider: Provider,
    credentialId: string,
  ): Promise<Result<void, AppError>>;
}
