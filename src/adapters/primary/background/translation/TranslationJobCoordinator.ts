import type { ISaveTranslationUseCase } from '../../../../core/ports/inbound/history/ISaveTranslationUseCase';
import type { IGetTranslationUseCase } from '../../../../core/ports/inbound/history/IGetTranslationUseCase';
import type { Translation } from '../../../../core/domain/translation/Translation';
import {
  AppError,
  ErrorCode,
  NetworkError,
  TranslationError,
} from '../../../../shared/errors';
import { failure, success, type Result } from '../../../../shared/types/Result';
import { serializeForModal } from '../../../../shared/types/TranslationModalPayload';
import type {
  TranslationRequestIdentity,
  TranslationStatusResponse,
} from '../../../../shared/messaging/MessageSchema';
import { TranslationProgressPublisher } from './TranslationProgressPublisher';
import {
  TranslationRequestRegistry,
  type ActiveTranslationJob,
  type TranslationOrigin,
  type TranslationTerminalSummary,
} from './TranslationRequestRegistry';
import {
  type ITranslationRequestPreparer,
  type PreparedTranslationRequest,
} from './TranslationRequestPreparer';
import {
  awaitTranslationWork,
  safeTranslationError,
} from './translation-job-utils';

export type TranslateImagePayload = TranslationRequestIdentity & {
  imageBase64: string;
};

type CompletedJob = Extract<TranslationTerminalSummary, { state: 'completed' }>;

interface JobOutcome {
  summary: TranslationTerminalSummary;
  result: Result<void, AppError>;
}

const PREPARATION_TIMEOUT_MS = 15_000;
const GENERATION_TIMEOUT_MS = 60_000;
const COMMIT_TIMEOUT_MS = 10_000;
const HISTORY_RECOVERY_TIMEOUT_MS = 2_000;

export interface TranslationJobDependencies {
  saveTranslationUseCase: ISaveTranslationUseCase;
  getTranslationUseCase: IGetTranslationUseCase;
}

/** Extension lifecycle coordination; generation and persistence remain separate use cases. */
export class TranslationJobCoordinator {
  constructor(
    private readonly deps: TranslationJobDependencies,
    private readonly preparer: ITranslationRequestPreparer,
    private readonly registry = new TranslationRequestRegistry(),
  ) {}

  handle(
    payload: TranslateImagePayload,
    origin: TranslationOrigin,
  ): Promise<Result<void, AppError>> {
    const existing = this.registry.get(payload, origin);

    if (existing) return existing.result;

    const summary = this.registry.summary(payload, origin);

    if (summary) return Promise.resolve(this.resultFromSummary(summary));

    if (this.registry.wasCancelled(payload, origin)) {
      return Promise.resolve(failure(TranslationError.cancelled()));
    }

    const job = this.registry.create(
      {
        requestId: payload.requestId,
        documentSessionId: payload.documentSessionId,
      },
      origin,
    );

    void this.run(job, payload.imageBase64).catch((error: unknown) => {
      const mapped = AppError.fromUnknown(error);

      this.registry.finish(
        job,
        { state: 'failed', error: safeTranslationError(mapped) },
        failure(mapped),
      );
    });

    return job.result;
  }

  cancel(
    identity: TranslationRequestIdentity,
    origin: TranslationOrigin,
  ): void {
    this.registry.cancel(identity, origin);
  }

  async status(
    identity: TranslationRequestIdentity,
    origin: TranslationOrigin,
  ): Promise<TranslationStatusResponse> {
    const job = this.registry.get(identity, origin);

    if (job) return { state: job.phase };

    const summary = this.registry.summary(identity, origin);

    if (!summary) {
      return this.registry.wasCancelled(identity, origin)
        ? { state: 'cancelled' }
        : { state: 'unknown' };
    }

    if (summary.state !== 'completed') return summary;
    if (!summary.historySaved) return { state: 'completed-unavailable' };

    return this.recoverCompleted(summary);
  }

  private async run(
    job: ActiveTranslationJob,
    imageBase64: string,
  ): Promise<void> {
    let publisher: TranslationProgressPublisher | undefined;

    let outcome: JobOutcome = this.failedOutcome(
      TranslationError.interrupted(),
    );

    try {
      const prepared = await this.prepare(job);
      const generationDeadlineAt = Date.now() + GENERATION_TIMEOUT_MS;

      publisher = new TranslationProgressPublisher(
        job.identity,
        job.origin,
        job.token,
        generationDeadlineAt,
      );

      const generated = prepared.success
        ? await this.generate(
            job,
            publisher,
            prepared.data,
            imageBase64,
            generationDeadlineAt,
          )
        : failure(prepared.error);

      const committed = generated.success
        ? await this.commit(job, publisher, generated.data)
        : failure(generated.error);

      outcome = committed.success
        ? { summary: committed.data, result: success(undefined) }
        : await this.finishFailure(job, publisher, committed.error);
    } catch (error: unknown) {
      const failed = this.failedOutcome(AppError.fromUnknown(error));

      outcome = failed;

      if (publisher)
        await publisher.control({
          kind: 'failed',
          error: failed.summary.error,
        });
    } finally {
      if (
        !outcome.result.success &&
        outcome.result.error instanceof NetworkError
      )
        job.token.cancel();

      publisher?.dispose();
      this.registry.finish(job, outcome.summary, outcome.result);
    }
  }

  private async prepare(
    job: ActiveTranslationJob,
  ): Promise<Result<PreparedTranslationRequest, AppError>> {
    const prepared = await awaitTranslationWork(
      this.preparer.prepare(),
      Date.now() + PREPARATION_TIMEOUT_MS,
      job.token,
    );

    return prepared.success ? prepared.data : failure(prepared.error);
  }

  private async generate(
    job: ActiveTranslationJob,
    publisher: TranslationProgressPublisher,
    prepared: PreparedTranslationRequest,
    imageBase64: string,
    generationDeadlineAt: number,
  ): Promise<Result<Translation, AppError>> {
    const started = await publisher.control({
      kind: 'started',
      targetLanguage: prepared.targetLanguage,
      generationDeadlineAt,
    });

    if (!started.success) return started;

    const generated = await awaitTranslationWork(
      prepared.useCase.execute({
        imageBase64,
        targetLanguageCode: prepared.targetLanguage.code,
        cancellationToken: job.token,
        generationDeadlineAt,
        progress: publisher,
      }),
      generationDeadlineAt,
      job.token,
    );

    if (
      !generated.success &&
      generated.error.code === ErrorCode.NETWORK_TIMEOUT
    ) {
      job.token.cancel();
    }

    const translation = generated.success
      ? generated.data
      : failure(generated.error);

    if (!translation.success)
      return failure(publisher.error ?? translation.error);
    if (job.token.isCancellationRequested)
      return failure(TranslationError.cancelled());

    return translation;
  }

  private async commit(
    job: ActiveTranslationJob,
    publisher: TranslationProgressPublisher,
    translation: Translation,
  ): Promise<Result<CompletedJob, AppError>> {
    const committing = await publisher.control({ kind: 'committing' });

    if (!committing.success) return committing;
    if (job.token.isCancellationRequested)
      return failure(TranslationError.cancelled());

    // No await between the last cancellation check and crossing the commit boundary.
    job.phase = 'committing';

    const saved = await awaitTranslationWork(
      this.deps.saveTranslationUseCase.execute({ translation }),
      Date.now() + COMMIT_TIMEOUT_MS,
    );

    if (!saved.success) return failure(saved.error);

    const summary: CompletedJob = {
      state: 'completed',
      translationId: translation.id,
      historySaved: saved.data.success,
    };

    await publisher.control({
      kind: 'completed',
      translation: serializeForModal(translation),
      historySaved: summary.historySaved,
    });

    return success(summary);
  }

  private async finishFailure(
    job: ActiveTranslationJob,
    publisher: TranslationProgressPublisher,
    error: AppError,
  ): Promise<JobOutcome> {
    const cancelled =
      error.code === ErrorCode.TRANSLATION_CANCELLED ||
      (job.token.isCancellationRequested &&
        !publisher.error &&
        error.code !== ErrorCode.NETWORK_TIMEOUT);

    if (cancelled) {
      await publisher.control({ kind: 'cancelled' });

      return {
        summary: { state: 'cancelled' },
        result: failure(TranslationError.cancelled()),
      };
    }

    const outcome = this.failedOutcome(error);

    await publisher.control({ kind: 'failed', error: outcome.summary.error });

    return outcome;
  }

  private failedOutcome(error: AppError) {
    return {
      summary: { state: 'failed' as const, error: safeTranslationError(error) },
      result: failure(error),
    };
  }

  private resultFromSummary(
    summary: TranslationTerminalSummary,
  ): Result<void, AppError> {
    if (summary.state === 'completed') return success(undefined);
    if (summary.state === 'cancelled')
      return failure(TranslationError.cancelled());

    const code =
      Object.values(ErrorCode).find((value) => value === summary.error.code) ??
      ErrorCode.TRANSLATION_FAILED;

    return failure(
      new AppError({ code, userMessage: summary.error.userMessage }),
    );
  }

  private async recoverCompleted(
    summary: CompletedJob,
  ): Promise<TranslationStatusResponse> {
    const loaded = await awaitTranslationWork(
      this.deps.getTranslationUseCase.execute(summary.translationId),
      Date.now() + HISTORY_RECOVERY_TIMEOUT_MS,
    );

    if (!loaded.success || !loaded.data.success || !loaded.data.data) {
      return { state: 'completed-unavailable' };
    }

    return {
      state: 'completed',
      translation: serializeForModal(loaded.data.data),
      historySaved: true,
    };
  }
}
