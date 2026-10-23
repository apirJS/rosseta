import { describe, expect, mock, test } from 'bun:test';
import type { ICancellationToken } from '../../../../core/ports/outbound/ICancellationToken';
import { ErrorCode } from '../../../../shared/errors';
import {
  deferred,
  nextTurn,
} from '../../../../../tests/background-translation-fixtures';
import { AbortCancellationToken } from './AbortCancellationToken';
import { awaitTranslationWork } from './translation-job-utils';

describe('Service: translation job work bounds', () => {
  test('rejects an already expired deadline even if work has already resolved', async () => {
    const result = await awaitTranslationWork(
      Promise.resolve('late'),
      Date.now() - 1,
    );

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
  });

  test('unsubscribes after normal completion', async () => {
    const unsubscribe = mock(() => {});

    const token: ICancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: () => unsubscribe,
    };

    expect(
      await awaitTranslationWork(
        Promise.resolve('complete'),
        Date.now() + 1_000,
        token,
      ),
    ).toEqual({ success: true, data: 'complete' });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('cleans up a token that notifies synchronously during subscription', async () => {
    const pending = deferred<string>();
    const unsubscribe = mock(() => {});

    const token: ICancellationToken = {
      isCancellationRequested: true,
      onCancellationRequested: (listener) => {
        listener();

        return unsubscribe;
      },
    };

    const result = await awaitTranslationWork(
      pending.promise,
      Date.now() + 1_000,
      token,
    );

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_CANCELLED);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    pending.resolve('late');
    await nextTurn();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('cancels promptly and handles a late provider rejection', async () => {
    const pending = deferred<string>();
    const token = new AbortCancellationToken();

    const running = awaitTranslationWork(
      pending.promise,
      Date.now() + 1_000,
      token,
    );

    token.cancel();

    const result = await running;

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_CANCELLED);
    pending.reject(new Error('late provider failure'));
    await nextTurn();
  });

  test('times out blocked work and consumes its late rejection', async () => {
    const pending = deferred<string>();
    const result = await awaitTranslationWork(pending.promise, Date.now() - 1);

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    pending.reject(new Error('late provider failure'));
    await nextTurn();
  });
});
