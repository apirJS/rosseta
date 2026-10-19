import type { ICancellationToken } from '../../../../core/ports/outbound/ICancellationToken';
import {
  AppError,
  ERROR_TITLES,
  NetworkError,
  TranslationError,
} from '../../../../shared/errors';
import { failure, success, type Result } from '../../../../shared/types/Result';
import type { SafeTranslationError } from '../../../../shared/validation/MessageSchema';

const noop = () => {};

export function safeTranslationError(error: AppError): SafeTranslationError {
  return {
    code: error.code,
    title: ERROR_TITLES[error.code],
    userMessage: error.userMessage,
  };
}

/** Bound a logical job without abandoning rejection handlers on the underlying operation. */
export function awaitTranslationWork<T>(
  work: Promise<T>,
  deadlineAt: number,
  cancellationToken?: ICancellationToken,
): Promise<Result<T, AppError>> {
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe = noop;

    const finish = (result: Result<T, AppError>) => {
      if (settled) return;

      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };

    const timer = setTimeout(
      () => finish(failure(NetworkError.timeout())),
      Math.max(0, deadlineAt - Date.now()),
    );
    unsubscribe =
      cancellationToken?.onCancellationRequested(() =>
        finish(failure(TranslationError.cancelled())),
      ) ?? unsubscribe;

    // Some token implementations notify synchronously during subscription.
    if (settled) unsubscribe();

    work.then(
      (value) => finish(success(value)),
      (error: unknown) => finish(failure(AppError.fromUnknown(error))),
    );

    if (deadlineAt <= Date.now()) finish(failure(NetworkError.timeout()));
  });
}
