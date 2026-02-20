import { AppError, type AppErrorOptions } from './AppError';
import { ErrorCode } from './ErrorCode';

export class AuthError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'code'> & { code?: ErrorCode }) {
    super({
      ...options,
      code: options.code ?? ErrorCode.AUTH_NOT_AUTHENTICATED,
    });
    this.name = 'AuthError';
  }

  public static invalidApiKey(apiKey?: string): AuthError {
    return new AuthError({
      code: ErrorCode.AUTH_INVALID_API_KEY,
      context: { apiKeyPrefix: apiKey?.slice(0, 8) },
    });
  }

  public static notAuthenticated(): AuthError {
    return new AuthError({
      code: ErrorCode.AUTH_NOT_AUTHENTICATED,
    });
  }
}
