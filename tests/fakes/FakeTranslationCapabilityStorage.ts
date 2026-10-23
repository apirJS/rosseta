import type {
  ITranslationCapabilityStorage,
  TranslationCapabilityFact,
  TranslationCapabilityRecord,
  TranslationCapabilityReadContext,
  TranslationCapabilityMergeContext,
} from '../../src/core/ports/outbound/ITranslationCapabilityStorage';
import { failure, success, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';
import {
  capabilityNamespaceGeneration,
  contextualCapabilityRecord,
  resetCapabilityRecord,
} from '../../src/adapters/secondary/translation/compatibility/translation-capability-lifecycle';

export class FakeTranslationCapabilityStorage implements ITranslationCapabilityStorage {
  readonly records = new Map<string, TranslationCapabilityRecord>();
  readonly resetCalls: string[] = [];
  readonly resetNamespaceCalls: string[] = [];
  readonly namespaceGenerations = new Map<string, number>();
  private injectedError: AppError | null = null;

  failWith(error: AppError): void {
    this.injectedError = error;
  }

  async read(
    identity: string,
    context?: TranslationCapabilityReadContext,
  ): Promise<Result<TranslationCapabilityRecord | null, AppError>> {
    if (this.injectedError) return this.takeFailure();

    if (context) {
      const record = this.resolveRecord(identity, context);

      return success(structuredClone(record));
    }

    return success(structuredClone(this.records.get(identity) ?? null));
  }

  async merge(
    identity: string,
    expectedGeneration: number,
    observations: Readonly<Record<string, TranslationCapabilityFact>>,
    context?: TranslationCapabilityMergeContext,
  ): Promise<Result<TranslationCapabilityRecord, AppError>> {
    if (this.injectedError) return this.takeFailure();

    const current = context
      ? this.resolveRecord(identity, context)
      : (this.records.get(identity) ?? {
          identity,
          generation: 0,
          facts: {},
          legacyCleared: false,
        });

    if (
      current.generation !== expectedGeneration ||
      (context &&
        context.namespaceGeneration !== capabilityNamespaceGeneration(current))
    )
      return success(structuredClone(current));

    const facts = { ...current.facts };

    for (const [key, fact] of Object.entries(observations)) {
      const prior = facts[key];

      if (
        prior &&
        prior.support !== 'unknown' &&
        (fact.support === 'unknown' || fact.observedAt < prior.observedAt)
      )
        continue;
      if (
        prior &&
        !/(?:metadata|default)/i.test(prior.source) &&
        prior.support !== 'unknown' &&
        /(?:metadata|default)/i.test(fact.source)
      )
        continue;
      facts[key] = { ...fact };
    }

    const updated = { ...current, facts };

    this.records.set(identity, updated);

    return success(structuredClone(updated));
  }

  async reset(identity: string): Promise<Result<void, AppError>> {
    this.resetCalls.push(identity);
    if (this.injectedError) return this.takeFailure();

    const current = this.records.get(identity) ?? {
      identity,
      generation: 0,
      facts: {},
      legacyCleared: false,
    };

    this.records.set(identity, resetCapabilityRecord(current, Date.now()));

    return success(undefined);
  }

  async resetNamespace(namespace: string): Promise<Result<void, AppError>> {
    this.resetNamespaceCalls.push(namespace);
    if (this.injectedError) return this.takeFailure();

    const generation = (this.namespaceGenerations.get(namespace) ?? 0) + 1;

    this.namespaceGenerations.set(namespace, generation);

    const now = Date.now();

    for (const [identity, record] of this.records) {
      if (record.namespace === namespace) {
        this.records.set(identity, {
          ...resetCapabilityRecord(record, now),
          namespaceGeneration: generation,
          refreshedAt: now,
        });
      }
    }

    return success(undefined);
  }

  private resolveRecord(
    identity: string,
    context: TranslationCapabilityReadContext,
  ): TranslationCapabilityRecord {
    const record = contextualCapabilityRecord(
      identity,
      this.records.get(identity),
      context,
      this.namespaceGenerations.get(context.namespace) ?? 0,
      Date.now(),
    );

    this.records.set(identity, record);

    return record;
  }

  private takeFailure(): Result<never, AppError> {
    const error = this.injectedError!;

    this.injectedError = null;

    return failure(error);
  }
}
