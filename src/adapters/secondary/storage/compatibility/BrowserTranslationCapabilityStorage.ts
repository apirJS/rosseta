import * as browser from 'webextension-polyfill';
import type {
  ITranslationCapabilityStorage,
  TranslationCapabilityFact,
  TranslationCapabilityMergeContext,
  TranslationCapabilityReadContext,
  TranslationCapabilityRecord,
} from '../../../../core/ports/outbound/ITranslationCapabilityStorage';
import { failure, success, type Result } from '../../../../shared/types/Result';
import { StorageError, type AppError } from '../../../../shared/errors';
import { registerLegacyCapabilityMigration } from '../../translation/compatibility/translation-capability-migration';
import {
  cloneCapabilityRecord,
  emptyCapabilityRecord,
} from '../../translation/compatibility/translation-capability-facts';
import {
  capabilityNamespaceGeneration,
  contextualCapabilityRecord,
  newerCapabilityRevision,
  resetCapabilityRecord,
} from '../../translation/compatibility/translation-capability-lifecycle';
import { migrateLegacyStructuredOutputExemption } from './legacy-structured-output-migration';
import {
  decodeCapabilityEnvelope,
  mergeCapabilityRecord,
  type CapabilityStorageEnvelope,
} from './translation-capability-codec';

export const TRANSLATION_CAPABILITIES_STORAGE_KEY = 'translationCapabilitiesV1';

// A local-storage key is replaced as one unit. Serialize whole transactions
// across adapter instances so concurrent models and provider resets cannot race.
let storageOperation: Promise<void> = Promise.resolve();
const confirmedNamespaceGenerations = new Map<string, number>();

function synchronizeNamespaceGenerations(
  namespaces: Readonly<Record<string, number>>,
): void {
  confirmedNamespaceGenerations.clear();

  for (const [namespace, generation] of Object.entries(namespaces)) {
    confirmedNamespaceGenerations.set(namespace, generation);
  }
}

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const operation = storageOperation.then(work, work);

  storageOperation = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

/** Operational compatibility knowledge, with lazy generation-based refresh. */
export class BrowserTranslationCapabilityStorage implements ITranslationCapabilityStorage {
  private readonly session = new Map<string, TranslationCapabilityRecord>();
  private readonly pending = new Map<string, TranslationCapabilityRecord>();

  constructor() {
    registerLegacyCapabilityMigration(this, (options) =>
      migrateLegacyStructuredOutputExemption(this, options),
    );
  }

  read(
    identity: string,
    context?: TranslationCapabilityReadContext,
  ): Promise<Result<TranslationCapabilityRecord | null, AppError>> {
    return serialized(async () => {
      let envelope: CapabilityStorageEnvelope;

      try {
        envelope = await this.readAll();
      } catch {
        return this.readCached(identity, context);
      }

      if (context) {
        const resolved = this.resolveRecord(envelope, identity, context);

        if (resolved.changed) await this.persistRefresh(envelope);

        return success(cloneCapabilityRecord(resolved.record));
      }

      const record = envelope.records[identity] ?? null;

      if (record) this.session.set(identity, cloneCapabilityRecord(record));
      else this.session.delete(identity);

      return success(record ? cloneCapabilityRecord(record) : null);
    });
  }

  merge(
    identity: string,
    expectedGeneration: number,
    observations: Readonly<Record<string, TranslationCapabilityFact>>,
    context?: TranslationCapabilityMergeContext,
  ): Promise<Result<TranslationCapabilityRecord, AppError>> {
    return serialized(async () => {
      let envelope: CapabilityStorageEnvelope;

      try {
        envelope = await this.readAll();
      } catch {
        this.retainPendingObservations(
          identity,
          expectedGeneration,
          observations,
          context,
        );

        return failure(
          StorageError.readFailed(TRANSLATION_CAPABILITIES_STORAGE_KEY),
        );
      }

      const resolved = this.resolveRecord(envelope, identity, context);
      const current = resolved.record;

      const staleNamespace =
        context &&
        context.namespaceGeneration !== capabilityNamespaceGeneration(current);

      if (current.generation !== expectedGeneration || staleNamespace) {
        if (resolved.changed) await this.persistRefresh(envelope);

        return success(cloneCapabilityRecord(current));
      }

      const updated = mergeCapabilityRecord(current, observations);

      this.stageRecord(envelope, updated);

      try {
        await this.writeAll(envelope);

        return success(cloneCapabilityRecord(updated));
      } catch {
        return failure(
          StorageError.writeFailed(TRANSLATION_CAPABILITIES_STORAGE_KEY),
        );
      }
    });
  }

  reset(identity: string): Promise<Result<void, AppError>> {
    return serialized(async () => {
      let envelope: CapabilityStorageEnvelope;

      try {
        envelope = await this.readAll();
      } catch {
        return failure(
          StorageError.readFailed(TRANSLATION_CAPABILITIES_STORAGE_KEY),
        );
      }

      const current =
        envelope.records[identity] ?? emptyCapabilityRecord(identity);

      const reset = resetCapabilityRecord(current, Date.now());

      this.putRecord(envelope, reset);

      try {
        await this.writeAll(envelope);
        this.session.set(identity, cloneCapabilityRecord(reset));

        return success(undefined);
      } catch {
        return failure(
          StorageError.writeFailed(TRANSLATION_CAPABILITIES_STORAGE_KEY),
        );
      }
    });
  }

  resetNamespace(namespace: string): Promise<Result<void, AppError>> {
    return serialized(async () => {
      let envelope: CapabilityStorageEnvelope;

      try {
        envelope = await this.readAll();
      } catch {
        return failure(
          StorageError.readFailed(TRANSLATION_CAPABILITIES_STORAGE_KEY),
        );
      }

      const generation = (envelope.namespaces[namespace] ?? 0) + 1;

      envelope.namespaces[namespace] = generation;

      const now = Date.now();
      const resetRecords: TranslationCapabilityRecord[] = [];

      for (const record of Object.values(envelope.records)) {
        if (record.namespace !== namespace) continue;

        const reset = resetCapabilityRecord(record, now);

        reset.namespaceGeneration = generation;
        reset.refreshedAt = now;
        resetRecords.push(reset);
        this.putRecord(envelope, reset);
      }

      try {
        await this.writeAll(envelope);
        for (const record of resetRecords)
          this.session.set(record.identity, cloneCapabilityRecord(record));

        return success(undefined);
      } catch {
        // A failed explicit refresh must not claim a durable namespace epoch.
        return failure(
          StorageError.writeFailed(TRANSLATION_CAPABILITIES_STORAGE_KEY),
        );
      }
    });
  }

  private resolveRecord(
    envelope: CapabilityStorageEnvelope,
    identity: string,
    context?: TranslationCapabilityReadContext,
  ): { record: TranslationCapabilityRecord; changed: boolean } {
    const existing = envelope.records[identity];

    const record = context
      ? contextualCapabilityRecord(
          identity,
          existing,
          context,
          envelope.namespaces[context.namespace] ?? 0,
          Date.now(),
        )
      : (existing ?? emptyCapabilityRecord(identity));

    const changed =
      Boolean(context) &&
      (!existing ||
        existing.generation !== record.generation ||
        existing.namespace !== record.namespace ||
        existing.namespaceGeneration !== record.namespaceGeneration ||
        existing.refreshedAt !== record.refreshedAt);

    if (changed) this.stageRecord(envelope, record);
    else this.session.set(identity, cloneCapabilityRecord(record));

    return { record, changed };
  }

  private readCached(
    identity: string,
    context?: TranslationCapabilityReadContext,
  ): Result<TranslationCapabilityRecord | null, AppError> {
    const cached = this.session.get(identity);

    if (!cached)
      return failure(
        StorageError.readFailed(TRANSLATION_CAPABILITIES_STORAGE_KEY),
      );

    const current = context
      ? contextualCapabilityRecord(
          identity,
          cached,
          context,
          confirmedNamespaceGenerations.get(context.namespace) ?? 0,
          Date.now(),
        )
      : cached;

    this.session.set(identity, cloneCapabilityRecord(current));
    if (newerCapabilityRevision(current, cached))
      this.pending.set(identity, cloneCapabilityRecord(current));

    return success(cloneCapabilityRecord(current));
  }

  private stageRecord(
    envelope: CapabilityStorageEnvelope,
    record: TranslationCapabilityRecord,
  ): void {
    this.putRecord(envelope, record);
    this.session.set(record.identity, cloneCapabilityRecord(record));
    this.pending.set(record.identity, cloneCapabilityRecord(record));
  }

  private putRecord(
    envelope: CapabilityStorageEnvelope,
    record: TranslationCapabilityRecord,
  ): void {
    Object.defineProperty(envelope.records, record.identity, {
      value: record,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  private async readAll(): Promise<CapabilityStorageEnvelope> {
    const stored = await browser.storage.local.get(
      TRANSLATION_CAPABILITIES_STORAGE_KEY,
    );

    const envelope = decodeCapabilityEnvelope(
      stored[TRANSLATION_CAPABILITIES_STORAGE_KEY],
    );

    synchronizeNamespaceGenerations(envelope.namespaces);
    this.overlayPendingRecords(envelope);

    return envelope;
  }

  private overlayPendingRecords(envelope: CapabilityStorageEnvelope): void {
    for (const [identity, pending] of this.pending) {
      const durable = envelope.records[identity];

      const namespaceAdvanced =
        pending.namespace !== undefined &&
        capabilityNamespaceGeneration(pending) <
          (envelope.namespaces[pending.namespace] ?? 0);

      if (
        namespaceAdvanced ||
        (durable && newerCapabilityRevision(durable, pending))
      ) {
        this.pending.delete(identity);
        if (durable) this.session.set(identity, cloneCapabilityRecord(durable));
        else this.session.delete(identity);

        continue;
      }

      if (!durable || newerCapabilityRevision(pending, durable)) {
        this.putRecord(envelope, cloneCapabilityRecord(pending));

        continue;
      }

      const merged = mergeCapabilityRecord(durable, pending.facts);

      this.putRecord(envelope, {
        ...pending,
        ...merged,
        ...(durable.refreshedAt !== undefined &&
        pending.refreshedAt !== undefined
          ? { refreshedAt: Math.min(durable.refreshedAt, pending.refreshedAt) }
          : {}),
        ...(durable.namespace === undefined && pending.namespace !== undefined
          ? {
              namespace: pending.namespace,
              namespaceGeneration: pending.namespaceGeneration,
              refreshedAt: pending.refreshedAt,
            }
          : {}),
      });
    }
  }

  private retainPendingObservations(
    identity: string,
    expectedGeneration: number,
    observations: Readonly<Record<string, TranslationCapabilityFact>>,
    context?: TranslationCapabilityMergeContext,
  ): void {
    const cached =
      this.session.get(identity) ?? emptyCapabilityRecord(identity);

    const current = context
      ? contextualCapabilityRecord(
          identity,
          cached,
          context,
          confirmedNamespaceGenerations.get(context.namespace) ?? 0,
          Date.now(),
        )
      : cached;

    this.session.set(identity, cloneCapabilityRecord(current));
    if (newerCapabilityRevision(current, cached))
      this.pending.set(identity, cloneCapabilityRecord(current));
    if (
      current.generation !== expectedGeneration ||
      (context &&
        context.namespaceGeneration !== capabilityNamespaceGeneration(current))
    )
      return;

    const updated = mergeCapabilityRecord(current, observations);

    this.session.set(identity, updated);
    this.pending.set(identity, updated);
  }

  private async persistRefresh(
    envelope: CapabilityStorageEnvelope,
  ): Promise<void> {
    try {
      await this.writeAll(envelope);
    } catch {
      // Continue with the refreshed session tombstone, never with expired facts.
      console.warn('[TRANSLATION] Compatibility refresh could not be retained');
    }
  }

  private async writeAll(envelope: CapabilityStorageEnvelope): Promise<void> {
    await browser.storage.local.set({
      [TRANSLATION_CAPABILITIES_STORAGE_KEY]: { version: 1, ...envelope },
    });

    synchronizeNamespaceGenerations(envelope.namespaces);
    this.pending.clear();
  }
}
