import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export type TranslationCapabilitySupport =
  'unknown' | 'supported' | 'unsupported';

/** Keys and evidence scopes are opaque to the application layer. */
export interface TranslationCapabilityFact {
  support: TranslationCapabilitySupport;
  source: string;
  observedAt: number;
  scope: string;
}

export interface TranslationCapabilityRecord {
  identity: string;
  generation: number;
  facts: Record<string, TranslationCapabilityFact>;
  legacyCleared: boolean;
  namespace?: string;
  namespaceGeneration?: number;
  refreshedAt?: number;
}

/** Opaque grouping and refresh policy supplied by the adapter composition. */
export interface TranslationCapabilityReadContext {
  namespace: string;
  refreshAfterMs: number;
}

export interface TranslationCapabilityMergeContext extends TranslationCapabilityReadContext {
  namespaceGeneration: number;
}

export interface ITranslationCapabilityStorage {
  read(
    identity: string,
    context?: TranslationCapabilityReadContext,
  ): Promise<Result<TranslationCapabilityRecord | null, AppError>>;
  /** Stale generations are ignored so a reset cannot be undone by an active job. */
  merge(
    identity: string,
    expectedGeneration: number,
    observations: Readonly<Record<string, TranslationCapabilityFact>>,
    context?: TranslationCapabilityMergeContext,
  ): Promise<Result<TranslationCapabilityRecord, AppError>>;
  /** Persist the new generation, including an intentional legacy-import tombstone. */
  reset(identity: string): Promise<Result<void, AppError>>;
  /** Refresh every model in an opaque namespace, including future lazy imports. */
  resetNamespace(namespace: string): Promise<Result<void, AppError>>;
}
