import { AppError, type AppErrorOptions } from './AppError';
import { ErrorCode } from './ErrorCode';

export class StorageError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'code'> & { code?: ErrorCode }) {
    super({
      ...options,
      code: options.code ?? ErrorCode.STORAGE_READ_FAILED,
    });
    this.name = 'StorageError';
  }

  public static quotaExceeded(): StorageError {
    return new StorageError({
      code: ErrorCode.STORAGE_QUOTA_EXCEEDED,
    });
  }

  public static readFailed(key: string): StorageError {
    return new StorageError({
      code: ErrorCode.STORAGE_READ_FAILED,
      context: { key },
    });
  }

  public static writeFailed(key: string, cause?: Error): StorageError {
    return new StorageError({
      code: ErrorCode.STORAGE_WRITE_FAILED,
      context: { key },
      cause,
    });
  }
}
