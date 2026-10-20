import type { AppError } from '../../../../shared/errors';
import type { Result } from '../../../../shared/types/Result';
import type {
  SafeTranslationError,
  TranslationRequestIdentity,
} from '../../../../shared/messaging/MessageSchema';
import { AbortCancellationToken } from './AbortCancellationToken';

export interface TranslationOrigin {
  tabId: number;
  frameId: number;
  documentId?: string;
}

export type TranslationTerminalSummary =
  | { state: 'completed'; translationId: string; historySaved: boolean }
  | { state: 'failed'; error: SafeTranslationError }
  | { state: 'cancelled' };

export interface ActiveTranslationJob {
  readonly identity: TranslationRequestIdentity;
  readonly origin: TranslationOrigin;
  readonly token: AbortCancellationToken;
  phase: 'active' | 'committing';
  readonly result: Promise<Result<void, AppError>>;
  readonly settle: (result: Result<void, AppError>) => void;
}

type Timed<T> = { value: T; expiresAt: number };

const RETENTION_MS = 120_000;
const MAX_SUMMARIES = 500;

export class TranslationRequestRegistry {
  private readonly active = new Map<string, ActiveTranslationJob>();
  private readonly terminal = new Map<
    string,
    Timed<TranslationTerminalSummary>
  >();
  private readonly cancelled = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  get(
    identity: TranslationRequestIdentity,
    origin: TranslationOrigin,
  ): ActiveTranslationJob | undefined {
    return this.active.get(this.key(identity, origin));
  }

  summary(
    identity: TranslationRequestIdentity,
    origin: TranslationOrigin,
  ): TranslationTerminalSummary | undefined {
    this.prune();

    return this.terminal.get(this.key(identity, origin))?.value;
  }

  wasCancelled(
    identity: TranslationRequestIdentity,
    origin: TranslationOrigin,
  ): boolean {
    this.prune();

    return this.cancelled.has(this.key(identity, origin));
  }

  create(
    identity: TranslationRequestIdentity,
    origin: TranslationOrigin,
  ): ActiveTranslationJob {
    let settle!: (result: Result<void, AppError>) => void;

    const result = new Promise<Result<void, AppError>>((resolve) => {
      settle = resolve;
    });

    const job: ActiveTranslationJob = {
      identity,
      origin,
      token: new AbortCancellationToken(),
      phase: 'active',
      result,
      settle,
    };

    this.active.set(this.key(identity, origin), job);

    return job;
  }

  cancel(
    identity: TranslationRequestIdentity,
    origin: TranslationOrigin,
  ): void {
    this.prune();

    const key = this.key(identity, origin);
    const job = this.active.get(key);

    if (job) {
      if (job.phase === 'active') job.token.cancel();

      return;
    }

    if (!this.terminal.has(key))
      this.cancelled.set(key, this.now() + RETENTION_MS);

    this.prune();
  }

  finish(
    job: ActiveTranslationJob,
    summary: TranslationTerminalSummary,
    result: Result<void, AppError>,
  ): void {
    const key = this.key(job.identity, job.origin);

    this.active.delete(key);

    this.terminal.set(key, {
      value: summary,
      expiresAt: this.now() + RETENTION_MS,
    });

    this.prune();
    job.settle(result);
  }

  private key(
    identity: TranslationRequestIdentity,
    origin: TranslationOrigin,
  ): string {
    return JSON.stringify([
      origin.tabId,
      origin.frameId,
      origin.documentId ?? null,
      identity.documentSessionId,
      identity.requestId,
    ]);
  }

  private prune(): void {
    const now = this.now();

    for (const [key, summary] of this.terminal) {
      if (summary.expiresAt <= now) this.terminal.delete(key);
    }

    for (const [key, expiresAt] of this.cancelled) {
      if (expiresAt <= now) this.cancelled.delete(key);
    }

    while (this.terminal.size > MAX_SUMMARIES) {
      this.terminal.delete(this.terminal.keys().next().value!);
    }

    while (this.cancelled.size > MAX_SUMMARIES) {
      this.cancelled.delete(this.cancelled.keys().next().value!);
    }
  }
}
