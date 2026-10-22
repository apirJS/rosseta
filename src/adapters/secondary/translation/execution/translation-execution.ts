import type { TranslationExecutionOptions } from '../../../../core/ports/outbound/TranslationExecutionOptions';
import { NetworkError, TranslationError } from '../../../../shared/errors';

const DEFAULT_GENERATION_TIMEOUT_MS = 60_000;

export interface TranslationExecutionScope {
  signal: AbortSignal;
  deadline: number;
  abort(reason: unknown): void;
  dispose(): void;
}

/** One cancellation subscription and deadline cover every attempt in a job. */
export function executionScope(
  options: TranslationExecutionOptions = {},
): TranslationExecutionScope {
  const controller = new AbortController();

  const deadline =
    options.generationDeadlineAt ?? Date.now() + DEFAULT_GENERATION_TIMEOUT_MS;

  const expire = () => {
    controller.abort(NetworkError.timeout());
  };

  const timer = setTimeout(expire, Math.max(0, deadline - Date.now()));

  const unsubscribe = options.cancellationToken?.onCancellationRequested(() => {
    controller.abort(TranslationError.cancelled());
  });

  if (options.cancellationToken?.isCancellationRequested) {
    controller.abort(TranslationError.cancelled());
  }

  if (deadline <= Date.now()) expire();

  return {
    signal: controller.signal,
    deadline,
    abort: (reason) => controller.abort(reason),
    dispose() {
      clearTimeout(timer);
      unsubscribe?.();
    },
  };
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason;
}

/** Observe late settlement even when the logical job finishes before native work. */
export function raceAbort<T>(
  work: PromiseLike<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return Promise.resolve(work);

  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason ?? TranslationError.cancelled());

    signal.addEventListener('abort', aborted, { once: true });

    Promise.resolve(work).then(
      (value) => {
        signal.removeEventListener('abort', aborted);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', aborted);
        reject(error);
      },
    );

    if (signal.aborted) aborted();
  });
}
