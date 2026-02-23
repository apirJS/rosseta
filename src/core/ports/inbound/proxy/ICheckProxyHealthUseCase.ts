import type { Result } from '../../../../shared/types/Result';
import type { AppError } from '../../../../shared/errors';

export interface ICheckProxyHealthUseCase {
  execute(proxyUrl: string): Promise<Result<boolean, AppError>>;
}
