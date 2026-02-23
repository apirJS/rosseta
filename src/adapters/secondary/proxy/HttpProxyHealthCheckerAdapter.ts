import type { IProxyHealthChecker } from '../../../core/ports/outbound/IProxyHealthChecker';
import { success, failure, type Result } from '../../../shared/types/Result';
import { BrowserError, type AppError } from '../../../shared/errors';

export class HttpProxyHealthCheckerAdapter implements IProxyHealthChecker {
  async check(proxyUrl: string): Promise<Result<boolean, AppError>> {
    try {
      const response = await fetch(proxyUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return success(response.ok);
    } catch (error) {
      return failure(
        BrowserError.communicationFailed(
          error instanceof Error ? error : new Error(String(error)),
        ),
      );
    }
  }
}
