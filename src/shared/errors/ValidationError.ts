import { AppError, type AppErrorOptions } from './AppError';
import { ErrorCode } from './ErrorCode';

export class ValidationError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'code'> & { code?: ErrorCode }) {
    super({
      ...options,
      code: options.code ?? ErrorCode.VALIDATION_INVALID_INPUT,
    });
    this.name = 'ValidationError';
  }

  public static invalidInput(
    message: string,
    context?: Record<string, unknown>,
  ): ValidationError {
    return new ValidationError({ message, userMessage: message, context });
  }
}
