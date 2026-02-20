import { AppError, type AppErrorOptions } from './AppError';
import { ErrorCode } from './ErrorCode';

export class BrowserError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'code'> & { code?: ErrorCode }) {
    super({
      ...options,
      code: options.code ?? ErrorCode.AUTH_NOT_AUTHENTICATED,
    });
    this.name = 'BrowserError';
  }
  static noActiveTab(context?: Record<string, unknown>): BrowserError {
    return new BrowserError({
      code: ErrorCode.BROWSER_NO_ACTIVE_TAB,
      context,
    });
  }

  static scriptInjectionFailed(
    cause?: Error,
    context?: Record<string, unknown>,
  ): BrowserError {
    return new BrowserError({
      code: ErrorCode.BROWSER_SCRIPT_INJECTION_FAILED,
      cause,
      context,
    });
  }

  static communicationFailed(
    cause?: Error,
    context?: Record<string, unknown>,
  ): BrowserError {
    return new BrowserError({
      code: ErrorCode.BROWSER_COMMUNICATION_FAILED,
      cause,
      context,
    });
  }
}
