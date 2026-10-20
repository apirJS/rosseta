import type {
  TranslationCapabilityReadContext,
  TranslationCapabilityRecord,
} from "../../../core/ports/outbound/ITranslationCapabilityStorage";
import { emptyCapabilityRecord } from "./translation-capability-facts";

export function capabilityNamespaceGeneration(
  record: TranslationCapabilityRecord,
): number {
  return record.namespaceGeneration ?? 0;
}

export function sameCapabilityRevision(
  left: TranslationCapabilityRecord,
  right: TranslationCapabilityRecord,
): boolean {
  return (
    left.generation === right.generation &&
    capabilityNamespaceGeneration(left) === capabilityNamespaceGeneration(right)
  );
}

export function newerCapabilityRevision(
  left: TranslationCapabilityRecord,
  right: TranslationCapabilityRecord,
): boolean {
  const namespace =
    capabilityNamespaceGeneration(left) - capabilityNamespaceGeneration(right);
  return (
    namespace > 0 || (namespace === 0 && left.generation > right.generation)
  );
}

export function resetCapabilityRecord(
  record: TranslationCapabilityRecord,
  now: number,
): TranslationCapabilityRecord {
  return {
    ...record,
    generation: record.generation + 1,
    facts: {},
    legacyCleared: true,
    ...(record.refreshedAt === undefined ? {} : { refreshedAt: now }),
  };
}

/** Bind old records once; expiry never slides when another observation succeeds. */
export function contextualCapabilityRecord(
  identity: string,
  existing: TranslationCapabilityRecord | undefined,
  context: TranslationCapabilityReadContext,
  namespaceGeneration: number,
  now: number,
): TranslationCapabilityRecord {
  const current = existing ?? emptyCapabilityRecord(identity);
  const alreadyBound = current.namespace !== undefined;
  const namespaceChanged =
    alreadyBound && current.namespace !== context.namespace;
  const epochChanged = alreadyBound
    ? capabilityNamespaceGeneration(current) !== namespaceGeneration
    : namespaceGeneration > 0;
  const refreshedAt = current.refreshedAt ?? oldestObservation(current, now);
  const bound = {
    ...current,
    namespace: context.namespace,
    namespaceGeneration,
    refreshedAt,
  };
  if (namespaceChanged || epochChanged) {
    return { ...resetCapabilityRecord(bound, now), refreshedAt: now };
  }
  if (now >= refreshedAt + context.refreshAfterMs) {
    return { ...resetCapabilityRecord(bound, now), refreshedAt: now };
  }
  return bound;
}

function oldestObservation(
  record: TranslationCapabilityRecord,
  now: number,
): number {
  const times = Object.values(record.facts)
    .filter((fact) => fact.support !== "unknown" && fact.observedAt > 0)
    .map((fact) => fact.observedAt);
  return times.length ? Math.min(...times) : now;
}
