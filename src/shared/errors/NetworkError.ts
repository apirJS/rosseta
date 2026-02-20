import { AppError, type AppErrorOptions } from './AppError';
import { ErrorCode } from './ErrorCode';

/**
 * Network-related errors.
 */
export class NetworkError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'code'> & { code?: ErrorCode }) {
    super({
      ...options,
      code: options.code ?? ErrorCode.NETWORK_SERVER_ERROR,
    });
    this.name = 'NetworkError';
  }

  public static offline(): NetworkError {
    return new NetworkError({
      code: ErrorCode.NETWORK_OFFLINE,
    });
  }

  public static timeout(url?: string): NetworkError {
    return new NetworkError({
      code: ErrorCode.NETWORK_TIMEOUT,
      context: { url },
    });
  }

  public static serverError(status: number, url?: string): NetworkError {
    return new NetworkError({
      code: ErrorCode.NETWORK_SERVER_ERROR,
      context: { status, url },
    });
  }

  /**
   * Create from a fetch error.
   */
  public static fromFetchError(error: Error, url?: string): NetworkError {
    if (!navigator.onLine) {
      return NetworkError.offline();
    }

    if (error.name === 'AbortError') {
      return NetworkError.timeout(url);
    }

    return new NetworkError({
      code: ErrorCode.NETWORK_SERVER_ERROR,
      cause: error,
      context: { url },
    });
  }
}
