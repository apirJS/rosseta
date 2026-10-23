import { describe, expect, spyOn, test } from 'bun:test';
import type { TranslationProgress } from '../../../../core/ports/outbound/TranslationExecutionOptions';
import { NetworkError, TranslationError } from '../../../../shared/errors';
import { failure, success } from '../../../../shared/types/Result';
import { executionScope } from '../execution/translation-execution';
import { TranslationAttemptPreview } from './TranslationAttemptPreview';

function partial(text: string) {
  return {
    type: 'partial' as const,
    value: { data: { segments: [{ originalText: text }] } },
  };
}

describe('Adapter: translation attempt preview lifecycle', () => {
  test('an attempt accepts provisional text and ignores old-reader events after disposal', async () => {
    const scope = executionScope();
    const reports: TranslationProgress[] = [];

    const preview = new TranslationAttemptPreview('structured-stream', scope, {
      report: async (event) => {
        reports.push(event);

        return success(undefined);
      },
    });

    try {
      await preview.receive(partial('First attempt'));
      preview.dispose();
      await preview.receive(partial('Late old reader'));
      expect(reports).toHaveLength(1);

      expect(
        reports[0].kind === 'snapshot' &&
          reports[0].draft.segments[0].originalText,
      ).toBe('First attempt');
    } finally {
      preview.dispose();
      scope.dispose();
    }
  });

  test('delivery failure ends the logical scope with the original error', async () => {
    const scope = executionScope();
    const error = NetworkError.connectionFailed();

    const preview = new TranslationAttemptPreview('structured-stream', scope, {
      report: async () => failure(error),
    });

    try {
      await expect(preview.receive(partial('Text'))).rejects.toBe(error);
      expect(scope.signal.aborted).toBe(true);
      expect(scope.signal.reason).toBe(error);
    } finally {
      preview.dispose();
      scope.dispose();
    }
  });

  test('a disposed attempt ignores a late observer rejection without cancelling its replacement', async () => {
    const scope = executionScope();
    const error = NetworkError.connectionFailed();
    let rejectDelivery!: (reason: unknown) => void;
    let reportStarted!: () => void;

    const entered = new Promise<void>((resolve) => {
      reportStarted = resolve;
    });

    const delivery = new Promise<never>((_, reject) => {
      rejectDelivery = reject;
    });

    const preview = new TranslationAttemptPreview('structured-stream', scope, {
      report: () => {
        reportStarted();

        return delivery;
      },
    });

    try {
      const pending = preview.receive(partial('Old attempt')).then(
        () => null,
        (reason) => reason,
      );

      await entered;
      preview.dispose();
      rejectDelivery(error);
      expect(await pending).toBe(error);
      expect(scope.signal.aborted).toBe(false);
    } finally {
      preview.dispose();
      scope.dispose();
    }
  });

  test('abort drops a queued latest snapshot even if its timer callback arrives late', async () => {
    const scope = executionScope();
    const clock = spyOn(Date, 'now').mockReturnValue(1000);
    const timers = spyOn(globalThis, 'setTimeout');
    const reports: TranslationProgress[] = [];

    const preview = new TranslationAttemptPreview('structured-stream', scope, {
      report: async (event) => {
        reports.push(event);

        return success(undefined);
      },
    });

    try {
      await preview.receive(partial('First'));
      await preview.receive(partial('Pending'));

      const flush = timers.mock.calls[0]?.[0];

      expect(typeof flush).toBe('function');
      scope.abort(TranslationError.cancelled());
      if (typeof flush === 'function') flush();
      await Promise.resolve();
      expect(reports).toHaveLength(1);
    } finally {
      preview.dispose();
      scope.dispose();
      timers.mockRestore();
      clock.mockRestore();
    }
  });
});
