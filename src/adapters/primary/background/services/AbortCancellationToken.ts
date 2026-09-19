import type { ICancellationToken } from '../../../../core/ports/outbound/ICancellationToken';

export class AbortCancellationToken implements ICancellationToken {
  private readonly controller = new AbortController();

  get isCancellationRequested(): boolean {
    return this.controller.signal.aborted;
  }

  cancel(): void {
    this.controller.abort();
  }

  onCancellationRequested(listener: () => void): () => void {
    this.controller.signal.addEventListener('abort', listener, { once: true });
    return () => this.controller.signal.removeEventListener('abort', listener);
  }
}
