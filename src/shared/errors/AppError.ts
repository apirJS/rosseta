import { ErrorCode, ERROR_MESSAGES } from './ErrorCode';

export interface AppErrorOptions {
  code: ErrorCode;
  message?: string;
  cause?: Error;
  context?: Record<string, unknown>;
}

/**
 * Base application error with code, context, and optional cause.
 * Use specific subclasses (AuthError, TranslationError, etc.) when possible.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly cause?: Error;

  constructor(options: AppErrorOptions) {
    super(options.message ?? ERROR_MESSAGES[options.code]);

    this.name = 'AppError';
    this.code = options.code;
    this.userMessage = ERROR_MESSAGES[options.code];
    this.context = options.context;
    this.timestamp = new Date();

    Error.captureStackTrace?.(this, this.constructor);

    if (options.cause) {
      this.cause = options.cause;
      if (options.cause instanceof Error && options.cause.stack) {
        this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
      }
    }
  }

  /**
   * Create an AppError from an unknown caught value.
   */
  public static fromUnknown(
    error: unknown,
    fallbackCode = ErrorCode.UNKNOWN_ERROR,
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError({
        code: fallbackCode,
        message: error.message,
        cause: error,
      });
    }

    return new AppError({
      code: fallbackCode,
      message: String(error),
    });
  }

  /**
   * Check if this error matches a specific code.
   */
  public is(code: ErrorCode): boolean {
    return this.code === code;
  }

  /**
   * Check if this error is in a category (e.g., all AUTH_ errors).
   */
  public isCategory(
    prefix: 'AUTH' | 'TRANSLATION' | 'NETWORK' | 'STORAGE' | 'VALIDATION',
  ): boolean {
    return this.code.startsWith(prefix);
  }

  /**
   * Serialize for logging or transmission.
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}
