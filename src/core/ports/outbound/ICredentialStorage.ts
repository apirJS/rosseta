import { Credentials } from '../../domain/credential/Credentials';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export interface ICredentialStorage {
  save(credentials: Credentials): Promise<Result<void, AppError>>;
  get(): Promise<Result<Credentials | null, AppError>>;
}
