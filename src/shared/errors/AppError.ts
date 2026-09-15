import { ErrorCode, ERROR_MESSAGES } from './ErrorCode';

export interface AppErrorOptions {
  code: ErrorCode;
  message?: string;
  cause?: Error;
  context?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(options: AppErrorOptions) {
    super(options.message ?? ERROR_MESSAGES[options.code], {
      cause: options.cause,
    });

    this.name = 'AppError';
    this.code = options.code;
    this.userMessage = ERROR_MESSAGES[options.code];
    this.context = options.context;
    this.timestamp = new Date();

    Error.captureStackTrace?.(this, this.constructor);

    if (options.cause instanceof Error && options.cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }

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

  public is(code: ErrorCode): boolean {
    return this.code === code;
  }

  public isCategory(
    prefix: 'AUTH' | 'TRANSLATION' | 'NETWORK' | 'STORAGE' | 'VALIDATION',
  ): boolean {
    return this.code.startsWith(prefix);
  }

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
