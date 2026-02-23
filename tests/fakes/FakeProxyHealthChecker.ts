import type { IProxyHealthChecker } from '../../src/core/ports/outbound/IProxyHealthChecker';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';

export class FakeProxyHealthChecker implements IProxyHealthChecker {
  private _healthy = true;
  private _error: AppError | null = null;

  setHealthy(healthy: boolean): void {
    this._healthy = healthy;
  }

  failNextCallWith(error: AppError): void {
    this._error = error;
  }

  async check(_proxyUrl: string): Promise<Result<boolean, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }
    return success(this._healthy);
  }
}
