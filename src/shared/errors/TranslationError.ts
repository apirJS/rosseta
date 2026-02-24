import { AppError, type AppErrorOptions } from './AppError';
import { ErrorCode } from './ErrorCode';

/**
 * Translation-related errors.
 */
export class TranslationError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'code'> & { code?: ErrorCode }) {
    super({
      ...options,
      code: options.code ?? ErrorCode.TRANSLATION_FAILED,
    });
    this.name = 'TranslationError';
  }

  public static failed(cause?: Error): TranslationError {
    return new TranslationError({
      code: ErrorCode.TRANSLATION_FAILED,
      message: cause?.message,
      cause,
    });
  }

  public static rateLimited(retryAfterMs?: number): TranslationError {
    return new TranslationError({
      code: ErrorCode.TRANSLATION_RATE_LIMITED,
      context: { retryAfterMs },
    });
  }

  public static invalidImage(): TranslationError {
    return new TranslationError({
      code: ErrorCode.TRANSLATION_INVALID_IMAGE,
    });
  }

  public static unsupportedLanguage(language: string): TranslationError {
    return new TranslationError({
      code: ErrorCode.TRANSLATION_UNSUPPORTED_LANGUAGE,
      context: { language },
    });
  }

  public static malformedResponse(): TranslationError {
    return new TranslationError({
      code: ErrorCode.TRANSLATION_MALFORMED_RESPONSE,
    });
  }

  public static aiRejected(reason: string): TranslationError {
    return new TranslationError({
      code: ErrorCode.TRANSLATION_AI_REJECTED,
      context: { reason },
    });
  }
}
