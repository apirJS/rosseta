import type { ITranslationProgressObserver } from '../../../core/ports/outbound/ITranslationProgressObserver';
import type { TranslationDraft } from '../../../core/ports/outbound/TranslationExecutionOptions';
import { TranslationError } from '../../../shared/errors';
import type { GenerationEvent, GenerationMode } from './ITranslationGenerationTransport';
import { MAX_TRANSLATION_BYTES, parsePartialTranslationJson } from './parse-partial-translation-json';
import { mapTranslationDraft } from './translation-draft-mapper';
import type { TranslationExecutionScope } from './translation-execution';
import { isStructured } from './translation-fallback';

const SNAPSHOT_INTERVAL_MS = 75;
const encoder = new TextEncoder();

/** Buffer, parse and publish provisional output for exactly one provider attempt. */
export class TranslationAttemptPreview {
  private active = true;
  private buffer = '';
  private byteCount = 0;
  private previousHighSurrogate = false;
  private lastParseAt = 0;
  private lastPublishAt = 0;
  private lastSnapshot = '';
  private pending: TranslationDraft | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly onAbort = () => this.dispose();

  constructor(
    private readonly mode: GenerationMode,
    private readonly scope: TranslationExecutionScope,
    private readonly observer?: ITranslationProgressObserver,
  ) {
    scope.signal.addEventListener('abort', this.onAbort, { once: true });
    if (scope.signal.aborted) this.dispose();
  }

  get text(): string {
    return this.buffer;
  }

  async receive(event: GenerationEvent): Promise<void> {
    if (!this.active || this.scope.signal.aborted) return;
    try {
      const draft = event.type === 'text'
        ? await this.receiveText(event.text)
        : mapTranslationDraft(event.value);
      if (draft) await this.offer(draft);
    } catch (error) {
      // Local parsing/delivery failures end the logical job immediately, even
      // when a native transport's iterator cleanup remains pending.
      this.abortIfActive(error);
      throw error;
    }
  }

  dispose(): void {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = null;
    this.scope.signal.removeEventListener('abort', this.onAbort);
  }

  private async receiveText(chunk: string): Promise<TranslationDraft | null> {
    this.append(chunk);
    if (isStructured(this.mode)) return null;
    if (this.lastParseAt !== 0 && Date.now() - this.lastParseAt < SNAPSHOT_INTERVAL_MS) return null;
    this.lastParseAt = Date.now();
    return parsePartialTranslationJson(this.buffer);
  }

  private append(chunk: string): void {
    this.byteCount += encoder.encode(chunk).byteLength;
    if (this.previousHighSurrogate && chunk.length && isLowSurrogate(chunk.charCodeAt(0))) {
      // Encoding two separate surrogate halves counts six replacement bytes;
      // the combined buffer contains one four-byte Unicode code point.
      this.byteCount -= 2;
    }
    if (chunk.length) {
      const lastCode = chunk.charCodeAt(chunk.length - 1);
      this.previousHighSurrogate = lastCode >= 0xd800 && lastCode <= 0xdbff;
    }
    if (this.byteCount > MAX_TRANSLATION_BYTES) throw TranslationError.responseLimit();
    this.buffer += chunk;
  }

  private async offer(draft: TranslationDraft): Promise<void> {
    if (!this.active || this.scope.signal.aborted) return;
    if (this.lastPublishAt === 0 && !hasUsefulText(draft)) return;
    if (this.lastPublishAt === 0 || Date.now() - this.lastPublishAt >= SNAPSHOT_INTERVAL_MS) {
      await this.publish(draft);
      return;
    }
    this.pending = draft;
    if (this.timer) return;
    const delay = Math.max(0, SNAPSHOT_INTERVAL_MS - (Date.now() - this.lastPublishAt));
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const next = this.pending;
      this.pending = null;
      if (next && !this.scope.signal.aborted) {
        void this.publish(next).catch(error => this.abortIfActive(error));
      }
    }, delay);
  }

  private async publish(draft: TranslationDraft): Promise<void> {
    if (!this.active || this.scope.signal.aborted) return;
    const fingerprint = JSON.stringify(draft);
    if (fingerprint === this.lastSnapshot) return;
    this.lastSnapshot = fingerprint;
    this.lastPublishAt = Date.now();
    try {
      const reported = await this.observer?.report({ kind: 'snapshot', draft });
      if (reported && !reported.success) throw reported.error;
    } catch (error) {
      // Display failures are never evidence of provider incompatibility.
      this.abortIfActive(error);
      throw error;
    }
  }

  private abortIfActive(error: unknown): void {
    // An old reader/report can settle after fallback has replaced this attempt.
    // Its failure must not cancel the replacement's shared execution scope.
    if (this.active && !this.scope.signal.aborted) this.scope.abort(error);
  }
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

function hasUsefulText(draft: TranslationDraft): boolean {
  return Boolean(draft.description) || draft.segments.some(segment => {
    return segment.originalText.length > 0 || segment.translatedText.length > 0;
  });
}
