import { AppError, type AppErrorOptions } from './AppError';
import { ErrorCode } from './ErrorCode';

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

  public static connectionFailed(url?: string, cause?: Error): NetworkError {
    return new NetworkError({
      code: ErrorCode.NETWORK_CONNECTION_FAILED,
      cause,
      context: { url },
    });
  }

  public static providerUnavailable(status?: number, url?: string): NetworkError {
    return new NetworkError({
      code: ErrorCode.NETWORK_PROVIDER_UNAVAILABLE,
      context: { status, url },
    });
  }

  public static rateLimited(url?: string): NetworkError {
    return new NetworkError({
      code: ErrorCode.NETWORK_RATE_LIMITED,
      context: { url },
    });
  }

  public static invalidResponse(url?: string): NetworkError {
    return new NetworkError({
      code: ErrorCode.NETWORK_INVALID_RESPONSE,
      context: { url },
    });
  }

  public static fromFetchError(error: Error, url?: string): NetworkError {
    if (!navigator.onLine) {
      return NetworkError.offline();
    }

    if (error.name === 'AbortError') {
      return NetworkError.timeout(url);
    }

    return NetworkError.connectionFailed(url, error);
  }
}
