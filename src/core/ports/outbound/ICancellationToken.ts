export interface ICancellationToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): () => void;
}
