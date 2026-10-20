import type { TranslationView } from '../../ui/injected/translation-result-modal/TranslationView';
import type {
  SafeTranslationError,
  TranslationAcknowledgement,
  TranslationEvent,
  TranslationRequestIdentity,
  TranslationStatusResponse,
} from '../../../../shared/messaging/MessageSchema';

export interface TranslationSessionDeps {
  cancel(identity: TranslationRequestIdentity): Promise<unknown>;
  status(
    identity: TranslationRequestIdentity,
  ): Promise<TranslationStatusResponse>;
  now?: () => number;
}

type CurrentRevisionEvent = Exclude<
  TranslationEvent,
  { kind: 'started' | 'reset' }
>;

const PREPARATION_TIMEOUT_MS = 15_000;
const STATUS_POLL_INTERVAL_MS = 15_000;
const STATUS_RESPONSE_TIMEOUT_MS = 2_000;
const COMMIT_TIMEOUT_MS = 10_000;

const interrupted: SafeTranslationError = {
  code: 'TRANSLATION_INTERRUPTED',
  title: 'Translation interrupted',
  userMessage:
    'The translation stopped before its final result was received. Select the area again to retry.',
};

/** Protocol/liveness state only. Reactive output belongs exclusively to the view. */
export class TranslationSession {
  private revision = 0;
  private sequence = -1;
  private started = false;
  private terminal = false;
  private closed = false;
  private abandoned = false;
  private isCommitting = false;
  private deadline: number;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private poll: ReturnType<typeof setInterval> | undefined;
  private polling = false;
  private cancellationSent = false;
  private readonly now: () => number;

  constructor(
    public readonly identity: TranslationRequestIdentity,
    private readonly view: TranslationView,
    private readonly deps: TranslationSessionDeps,
    private readonly detach: () => void,
  ) {
    this.now = deps.now ?? Date.now;
    this.deadline = this.now() + PREPARATION_TIMEOUT_MS;
    this.armWatchdog();

    this.poll = setInterval(() => {
      void this.reconcile();
    }, STATUS_POLL_INTERVAL_MS);
  }

  get isClosed(): boolean {
    return this.closed;
  }

  get isTerminal(): boolean {
    return this.terminal;
  }

  accept(event: TranslationEvent): TranslationAcknowledgement {
    if (
      event.documentSessionId !== this.identity.documentSessionId ||
      event.requestId !== this.identity.requestId
    )
      return { status: 'unknown' };
    if (this.closed || this.abandoned) return { status: 'closed' };
    if (this.terminal || event.sequence <= this.sequence)
      return { status: 'stale' };
    if (!this.applyEvent(event)) return { status: 'stale' };
    this.sequence = event.sequence;

    return { status: 'accepted' };
  }

  private applyEvent(event: TranslationEvent): boolean {
    switch (event.kind) {
      case 'started':
        if (this.started || event.revision !== 0) return false;
        this.started = true;
        this.deadline = event.generationDeadlineAt;
        this.view.started(event.targetLanguage);
        this.armWatchdog();

        return true;

      case 'reset':
        if (
          !this.started ||
          this.isCommitting ||
          event.revision !== this.revision + 1
        )
          return false;
        this.revision = event.revision;
        this.view.reset();

        return true;

      default:
        return (
          event.revision === this.revision &&
          this.applyCurrentRevisionEvent(event)
        );
    }
  }

  private applyCurrentRevisionEvent(event: CurrentRevisionEvent): boolean {
    switch (event.kind) {
      case 'snapshot':
        if (!this.started || this.isCommitting || this.revision === 0)
          return false;
        this.view.snapshot(event.draft);

        return true;

      case 'committing':
        if (this.isCommitting) return false;
        this.isCommitting = true;
        this.deadline = this.now() + COMMIT_TIMEOUT_MS;
        this.view.committing();
        this.armWatchdog();

        return true;

      case 'completed':
        this.finish(() =>
          this.view.completed(event.translation, event.historySaved),
        );

        return true;

      case 'failed':
        this.finish(() => this.view.failed(event.error));

        return true;

      case 'cancelled':
        this.finish(() => this.view.cancelled());

        return true;
    }
  }

  runtimeSettled(): void {
    if (!this.terminal && !this.closed) void this.reconcile();
  }

  runtimeFailed(): void {
    this.interruptAndCancel();
  }

  checkDeadline(): void {
    if (!this.terminal && !this.closed && this.now() >= this.deadline) {
      this.interruptAndCancel({
        code: 'TRANSLATION_TIMEOUT',
        title: 'Translation timed out',
        userMessage:
          'The translation took too long. Select the area again to retry.',
      });
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (!this.terminal) this.cancelQuietly();
    this.stopTimers();
    this.view.dispose();
    this.detach();
  }

  private cancelQuietly(): void {
    if (this.cancellationSent) return;
    this.cancellationSent = true;
    void this.deps.cancel(this.identity).catch(() => {});
  }

  private finish(update: () => void): void {
    this.terminal = true;
    this.stopTimers();
    update();
  }

  private interrupt(error = interrupted): void {
    if (!this.terminal && !this.closed) {
      this.abandoned = true;
      this.finish(() => this.view.failed(error));
    }
  }

  private interruptAndCancel(error = interrupted): void {
    this.interrupt(error);
    this.cancelQuietly();
  }

  private armWatchdog(): void {
    if (this.watchdog) clearTimeout(this.watchdog);

    this.watchdog = setTimeout(
      () => this.checkDeadline(),
      Math.max(0, this.deadline - this.now()),
    );
  }

  private stopTimers(): void {
    if (this.watchdog) clearTimeout(this.watchdog);
    if (this.poll) clearInterval(this.poll);
    this.watchdog = undefined;
    this.poll = undefined;
  }

  private async reconcile(): Promise<void> {
    if (this.terminal || this.closed || this.polling) return;
    this.checkDeadline();
    if (this.terminal) return;
    this.polling = true;

    try {
      const status = await this.readStatus();

      if (this.closed || this.terminal) return;
      this.applyRecoveredStatus(status);
    } catch {
      this.interruptAndCancel();
    } finally {
      this.polling = false;
    }
  }

  private async readStatus(): Promise<TranslationStatusResponse> {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        this.deps.status(this.identity),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Status timeout')),
            STATUS_RESPONSE_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private applyRecoveredStatus(status: TranslationStatusResponse): void {
    switch (status.state) {
      case 'completed':
        this.finish(() =>
          this.view.completed(status.translation, status.historySaved),
        );

        break;

      case 'failed':
        this.finish(() => this.view.failed(status.error));

        break;

      case 'cancelled':
        this.finish(() => this.view.cancelled());

        break;

      case 'completed-unavailable':
        this.interrupt(
          status.error ?? {
            ...interrupted,
            title: 'Final result unavailable',
          },
        );

        break;

      case 'unknown':
        this.interruptAndCancel();

        break;

      case 'active':

      case 'committing':
        break;
    }
  }
}
