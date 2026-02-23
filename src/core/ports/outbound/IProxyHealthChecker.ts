import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export interface IProxyHealthChecker {
  check(proxyUrl: string): Promise<Result<boolean, AppError>>;
}
