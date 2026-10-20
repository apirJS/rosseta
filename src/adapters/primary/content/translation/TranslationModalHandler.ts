import { sendMessageToRuntime } from '../../../../shared/messaging/index';
import type { TranslationModalPayload } from '../../../../shared/types/TranslationModalPayload';
import type {
  TranslationAcknowledgement,
  TranslationEvent,
  TranslationRequestIdentity,
} from '../../../../shared/messaging/MessageSchema';
import {
  mountTranslationModal,
  type MountedTranslationView,
} from '../../ui/injected/translation-result-modal/mountTranslationModal.svelte';
import {
  TranslationSession,
  type TranslationSessionDeps,
} from './TranslationSession';
import type { ThemeManager } from '../hosts/ThemeManager';

export type TranslationViewMount = typeof mountTranslationModal;

const CLOSED_REQUEST_RETENTION_MS = 120_000;
const MAX_CLOSED_REQUESTS = 500;

export class TranslationModalHandler {
  private documentSessionId = crypto.randomUUID();
  private readonly live = new Map<string, TranslationSession>();
  private readonly closed = new Map<string, number>();

  constructor(
    private readonly themeManager: ThemeManager,
    private readonly mountView: TranslationViewMount = mountTranslationModal,
    private readonly sessionDeps: TranslationSessionDeps = {
      cancel: (payload) =>
        sendMessageToRuntime({ action: 'CANCEL_TRANSLATION', payload }),
      status: (payload) =>
        sendMessageToRuntime({ action: 'GET_TRANSLATION_STATUS', payload }),
    },
  ) {}

  get sessionId(): string {
    return this.documentSessionId;
  }

  register(requestId: string): TranslationRequestIdentity {
    this.prune();

    const identity = { requestId, documentSessionId: this.documentSessionId };

    if (this.live.has(requestId) || this.closed.has(requestId)) return identity;

    const mounted = this.mountView(
      this.themeManager,
      'rosseta-live-' + requestId,
      () => this.live.get(requestId)?.close(),
    );

    const session = new TranslationSession(
      identity,
      mounted.view,
      this.sessionDeps,
      () => this.detachSession(requestId, mounted),
    );

    this.live.set(requestId, session);

    return identity;
  }

  private detachSession(
    requestId: string,
    mounted: MountedTranslationView,
  ): void {
    mounted.detach();
    this.live.delete(requestId);
    this.closed.set(requestId, Date.now());
    this.prune();
  }

  receive(event: TranslationEvent): TranslationAcknowledgement {
    if (event.documentSessionId !== this.documentSessionId)
      return { status: 'unknown' };
    this.prune();
    if (this.closed.has(event.requestId)) return { status: 'closed' };

    return (
      this.live.get(event.requestId)?.accept(event) ?? { status: 'unknown' }
    );
  }

  runtimeSettled(requestId: string): void {
    this.live.get(requestId)?.runtimeSettled();
  }

  runtimeFailed(requestId: string): void {
    this.live.get(requestId)?.runtimeFailed();
  }

  checkDeadlines(): void {
    for (const session of this.live.values()) session.checkDeadline();
  }

  dispose(): void {
    for (const session of this.live.values()) session.close();
  }

  resetDocument(): void {
    this.dispose();
    this.documentSessionId = crypto.randomUUID();
    this.closed.clear();
  }

  handle(payload: TranslationModalPayload): void {
    let mounted: MountedTranslationView;

    mounted = this.mountView(
      this.themeManager,
      'rosseta-modal-' + payload.id,
      () => mounted.detach(),
      payload,
    );
  }

  private prune(): void {
    const cutoff = Date.now() - CLOSED_REQUEST_RETENTION_MS;

    for (const [id, closedAt] of this.closed) {
      if (closedAt < cutoff) this.closed.delete(id);
    }

    while (this.closed.size > MAX_CLOSED_REQUESTS) {
      const oldest = this.closed.keys().next().value;

      if (oldest !== undefined) this.closed.delete(oldest);
    }
  }
}
