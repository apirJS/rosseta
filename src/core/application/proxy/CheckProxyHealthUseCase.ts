import type { ICheckProxyHealthUseCase } from '../../ports/inbound/proxy/ICheckProxyHealthUseCase';
import type { IProxyHealthChecker } from '../../ports/outbound/IProxyHealthChecker';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class CheckProxyHealthUseCase implements ICheckProxyHealthUseCase {
  constructor(private readonly healthChecker: IProxyHealthChecker) {}

  async execute(proxyUrl: string): Promise<Result<boolean, AppError>> {
    return this.healthChecker.check(proxyUrl);
  }
}
