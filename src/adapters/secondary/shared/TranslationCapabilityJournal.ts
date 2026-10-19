import type {
  ITranslationCapabilityStorage,
  TranslationCapabilityRecord,
  TranslationCapabilityReadContext,
} from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import {
  cloneCapabilityRecord,
  emptyCapabilityRecord,
  newerCachedCapabilityFacts,
  recoverableCapabilityFacts,
  unpersistedCapabilityFacts,
  type CapabilityFacts,
} from './translation-capability-facts';
import {
  capabilityNamespaceGeneration,
  contextualCapabilityRecord,
  newerCapabilityRevision,
  sameCapabilityRevision,
} from './translation-capability-lifecycle';

// Failed writes survive subsequent requests using the same storage instance.
const sessions = new WeakMap<ITranslationCapabilityStorage, Map<string, TranslationCapabilityRecord>>();

/** Persist observations within one reset generation, retaining failures for retry. */
export class TranslationCapabilityJournal {
  private current: TranslationCapabilityRecord;
  private observationGeneration: number | undefined;
  private observationNamespaceGeneration: number | undefined;
  private learningEnabled = true;
  private pending: CapabilityFacts = {};

  constructor(
    private readonly identity: string,
    private readonly storage: ITranslationCapabilityStorage,
    private readonly context?: TranslationCapabilityReadContext,
  ) {
    this.current = emptyCapabilityRecord(identity);
  }

  get facts(): Readonly<CapabilityFacts> {
    return this.current.facts;
  }

  get scopeContext(): TranslationCapabilityReadContext | undefined {
    return this.context;
  }

  async load(): Promise<void> {
    const stored = await this.storage.read(this.identity, this.context);
    const cached = this.cachedRecord();
    if (stored.success && stored.data) this.current = stored.data;

    if (cached && (!stored.success || !stored.data)) {
      this.current = this.context
        ? contextualCapabilityRecord(this.identity, cached, this.context, capabilityNamespaceGeneration(cached), Date.now())
        : cloneCapabilityRecord(cached);
      this.pending = { ...this.current.facts };
    } else if (cached && this.cachedRecordExpired(cached)) {
      sessions.get(this.storage)?.delete(this.identity);
    } else if (cached && sameCapabilityRevision(cached, this.current)) {
      this.supplementWithCachedFacts(cached.facts);
    } else if (cached && stored.success && stored.data && newerCapabilityRevision(stored.data, cached)) {
      sessions.get(this.storage)?.delete(this.identity);
    }

    this.observationGeneration ??= this.current.generation;
    this.observationNamespaceGeneration ??= capabilityNamespaceGeneration(this.current);
  }

  adoptMigration(imported: TranslationCapabilityRecord): void {
    if (!this.matchesObservationRevision(imported)) {
      this.stopLearning();
      this.current = imported;
      return;
    }

    this.pending = newerCachedCapabilityFacts(imported.facts, this.pending);
    this.current = { ...imported, facts: { ...imported.facts, ...this.pending } };
  }

  async record(observations: CapabilityFacts): Promise<void> {
    const generation = this.observationGeneration ??= this.current.generation;
    this.observationNamespaceGeneration ??= capabilityNamespaceGeneration(this.current);
    // Even after a reset, local evidence guides this request's remaining fallback.
    this.current = { ...this.current, facts: { ...this.current.facts, ...observations } };
    if (!this.canLearn(generation)) return;

    this.pending = { ...this.pending, ...observations };
    const merged = await this.storage.merge(this.identity, generation, { ...this.pending }, this.context ? {
      ...this.context, namespaceGeneration: this.observationNamespaceGeneration,
    } : undefined);
    if (!merged.success) {
      console.warn('[TRANSLATION] Compatibility knowledge could not be retained', merged.error.code);
      this.retainFailedWrite(generation);
      return;
    }

    if (!this.matchesObservationRevision(merged.data)) {
      // Never adopt a reset generation for later observations from this request.
      this.stopLearning();
      return;
    }

    this.current = merged.data;
    this.pending = {};
    this.removePersistedSessionFacts(generation);
  }

  private cachedRecord(): TranslationCapabilityRecord | undefined {
    return sessions.get(this.storage)?.get(this.identity);
  }

  private supplementWithCachedFacts(facts: Readonly<CapabilityFacts>): void {
    const newer = newerCachedCapabilityFacts(this.current.facts, facts);
    this.current = { ...this.current, facts: { ...this.current.facts, ...newer } };
    this.pending = { ...this.pending, ...newer };
  }

  private canLearn(generation: number): boolean {
    if (!this.learningEnabled) return false;
    const cached = this.cachedRecord();
    const observation = { ...this.current, generation, namespaceGeneration: this.observationNamespaceGeneration ?? 0 };
    if (!cached || !newerCapabilityRevision(cached, observation)) return true;
    this.stopLearning();
    return false;
  }

  private stopLearning(): void {
    this.learningEnabled = false;
    this.pending = {};
    const session = sessions.get(this.storage);
    const cached = session?.get(this.identity);
    if (session && cached && this.matchesObservationRevision(cached)) {
      session.delete(this.identity);
    }
  }

  private removePersistedSessionFacts(generation: number): void {
    const session = sessions.get(this.storage);
    const remaining = session?.get(this.identity);
    if (!session || !remaining || remaining.generation !== generation || !this.matchesObservationRevision(remaining)) return;

    const facts = unpersistedCapabilityFacts(this.current.facts, remaining.facts);
    if (Object.keys(facts).length) session.set(this.identity, { ...remaining, facts });
    else session.delete(this.identity);
  }

  private retainFailedWrite(generation: number): void {
    if (!this.canLearn(generation)) return;

    let session = sessions.get(this.storage);
    if (!session) {
      session = new Map();
      sessions.set(this.storage, session);
    }

    const previous = session.get(this.identity);
    const remaining = previous && this.matchesObservationRevision(previous)
      ? recoverableCapabilityFacts(this.current.facts, previous.facts)
      : {};
    const facts = { ...this.current.facts, ...remaining };
    session.set(this.identity, cloneCapabilityRecord({ ...this.current, facts }));
  }

  private matchesObservationRevision(record: TranslationCapabilityRecord): boolean {
    return record.generation === this.observationGeneration &&
      capabilityNamespaceGeneration(record) === (this.observationNamespaceGeneration ?? 0);
  }

  private cachedRecordExpired(record: TranslationCapabilityRecord): boolean {
    if (!this.context) return false;
    const refreshed = contextualCapabilityRecord(
      this.identity, record, this.context, capabilityNamespaceGeneration(record), Date.now(),
    );
    return newerCapabilityRevision(refreshed, record);
  }
}
