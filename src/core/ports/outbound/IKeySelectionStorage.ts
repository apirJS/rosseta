import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';
import type { KeySelectionMode } from '../../domain/credential/KeySelectionMode';
import type { AnyProvider } from '../../domain/credential/Provider';

export interface IKeySelectionStorage {
  getMode(): Promise<Result<KeySelectionMode, AppError>>;
  setMode(mode: KeySelectionMode): Promise<Result<void, AppError>>;
  getLastUsedId(
    provider: AnyProvider,
  ): Promise<Result<string | null, AppError>>;
  setLastUsedId(
    provider: AnyProvider,
    credentialId: string,
  ): Promise<Result<void, AppError>>;
  getAllLastUsedIds(): Promise<
    Result<Record<string, string>, AppError>
  >;
  replaceLastUsedIds(
    ids: Record<string, string>,
  ): Promise<Result<void, AppError>>;
}
