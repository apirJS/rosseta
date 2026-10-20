import type { ITranslationProgressObserver } from '../../../../core/ports/outbound/ITranslationProgressObserver';
import type {
  TranslationDraft,
  TranslationProgress,
} from '../../../../core/ports/outbound/TranslationExecutionOptions';
import {
  BrowserError,
  TranslationError,
  type AppError,
} from '../../../../shared/errors';
import { sendMessageToTab } from '../../../../shared/messaging/index';
import { failure, success, type Result } from '../../../../shared/types/Result';
import type {
  TranslationAcknowledgement,
  TranslationEvent,
  TranslationRequestIdentity,
} from '../../../../shared/messaging/MessageSchema';
import type { AbortCancellationToken } from './AbortCancellationToken';
import type { TranslationOrigin } from './TranslationRequestRegistry';
import { awaitTranslationWork } from './translation-job-utils';

type EnvelopeKeys = 'requestId' | 'documentSessionId' | 'revision' | 'sequence';

export type TranslationEventContent = {
  [Kind in TranslationEvent['kind']]: Omit<
    Extract<TranslationEvent, { kind: Kind }>,
    EnvelopeKeys
  >;
}[TranslationEvent['kind']];

type EventSender = (
  event: TranslationEvent,
) => Promise<TranslationAcknowledgement>;

const SNAPSHOT_INTERVAL_MS = 75;
const ACKNOWLEDGEMENT_TIMEOUT_MS = 2_000;

/** One ordered control channel and one replaceable draft slot per request. */
export class TranslationProgressPublisher implements ITranslationProgressObserver {
  private revision = 0;
  private sequence = 0;
  private tail: Promise<Result<void, AppError>> = Promise.resolve(
    success(undefined),
  );
  private pending: TranslationDraft | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastSentAt = 0;
  private lastSnapshot = '';
  private snapshotInFlight = false;
  private disposed = false;
  private deliveryError: AppError | undefined;
  private readonly sender: EventSender;

  constructor(
    private readonly identity: TranslationRequestIdentity,
    origin: TranslationOrigin,
    private readonly cancellation: AbortCancellationToken,
    private readonly deadlineAt: number,
    sender?: EventSender,
  ) {
    this.sender =
      sender ??
      ((event) =>
        sendMessageToTab(
          origin.tabId,
          {
            action: 'TRANSLATION_EVENT',
            payload: event,
          },
          origin.documentId
            ? { documentId: origin.documentId }
            : { frameId: origin.frameId },
        ));
  }

  get error(): AppError | undefined {
    return this.deliveryError;
  }

  async report(progress: TranslationProgress): Promise<Result<void, AppError>> {
    if (this.cancellation.isCancellationRequested || this.disposed) {
      return failure(this.deliveryError ?? TranslationError.cancelled());
    }

    if (progress.kind === 'reset') return this.reset();
    this.queueSnapshot(progress.draft);

    return success(undefined);
  }

  control(content: TranslationEventContent): Promise<Result<void, AppError>> {
    this.clearPending();

    return this.enqueue(content);
  }

  dispose(): void {
    this.clearPending();
    this.disposed = true;
  }

  private reset(): Promise<Result<void, AppError>> {
    this.clearPending();
    this.lastSnapshot = '';
    this.lastSentAt = 0;
    this.revision++;

    return this.enqueue({ kind: 'reset' });
  }

  private queueSnapshot(draft: TranslationDraft): void {
    const signature = JSON.stringify(draft);

    if (signature === this.lastSnapshot) return;
    this.lastSnapshot = signature;
    this.pending = draft;
    if (this.timer) return;

    const delay = this.snapshotDelay();

    if (delay === 0) this.drain();
    else this.scheduleDrain(delay);
  }

  private snapshotDelay(): number {
    return Math.max(0, SNAPSHOT_INTERVAL_MS - (Date.now() - this.lastSentAt));
  }

  private scheduleDrain(delay: number): void {
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.drain();
    }, delay);
  }

  private clearPending(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
  }

  private drain(): void {
    if (this.snapshotInFlight) return;

    const draft = this.pending;

    this.pending = undefined;
    if (!draft || this.disposed || this.cancellation.isCancellationRequested)
      return;

    this.snapshotInFlight = true;
    this.lastSentAt = Date.now();

    void this.enqueue({
      kind: 'snapshot',
      draft: { ...draft, segments: [...draft.segments] },
    }).then(() => this.snapshotDelivered());
  }

  private snapshotDelivered(): void {
    this.snapshotInFlight = false;

    if (
      this.pending &&
      !this.timer &&
      !this.disposed &&
      !this.cancellation.isCancellationRequested
    ) {
      this.scheduleDrain(this.snapshotDelay());
    }
  }

  private enqueue(
    content: TranslationEventContent,
  ): Promise<Result<void, AppError>> {
    const event = {
      ...this.identity,
      revision: this.revision,
      sequence: ++this.sequence,
      ...content,
    } as TranslationEvent;

    const next = this.tail
      .then((previous) => (previous.success ? this.deliver(event) : previous))
      .catch(() => this.failDelivery());

    this.tail = next;

    return next;
  }

  private async deliver(
    event: TranslationEvent,
  ): Promise<Result<void, AppError>> {
    if (this.disposed) return failure(TranslationError.cancelled());

    const deadline = this.deliveryDeadline(event.kind);
    let sent: Promise<TranslationAcknowledgement>;

    try {
      sent = this.sender(event);
    } catch {
      return this.failDelivery();
    }

    const result = await awaitTranslationWork(sent, deadline);

    if (result.success && this.acknowledged(event.kind, result.data))
      return success(undefined);

    return this.failDelivery();
  }

  private deliveryDeadline(kind: TranslationEvent['kind']): number {
    const acknowledgementDeadline = Date.now() + ACKNOWLEDGEMENT_TIMEOUT_MS;

    const terminal =
      kind === 'completed' || kind === 'failed' || kind === 'cancelled';

    return terminal
      ? acknowledgementDeadline
      : Math.min(this.deadlineAt, acknowledgementDeadline);
  }

  private acknowledged(
    kind: TranslationEvent['kind'],
    acknowledgement: TranslationAcknowledgement,
  ): boolean {
    return (
      acknowledgement?.status === 'accepted' ||
      (acknowledgement?.status === 'stale' && kind === 'snapshot')
    );
  }

  private failDelivery(): Result<void, AppError> {
    this.deliveryError ??= BrowserError.communicationFailed();
    this.clearPending();
    this.cancellation.cancel();

    return failure(this.deliveryError);
  }
}
