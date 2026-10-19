import type {
  TranslationCapabilityFact,
  TranslationCapabilityRecord,
} from '../../../core/ports/outbound/ITranslationCapabilityStorage';

export type CapabilityFacts = Record<string, TranslationCapabilityFact>;

export function emptyCapabilityRecord(identity: string): TranslationCapabilityRecord {
  return { identity, generation: 0, facts: {}, legacyCleared: false };
}

export function cloneCapabilityRecord(record: TranslationCapabilityRecord): TranslationCapabilityRecord {
  return structuredClone(record);
}

function isDeclaredEvidence(fact: TranslationCapabilityFact): boolean {
  return /(?:metadata|default)/i.test(fact.source);
}

function isObservedEvidence(fact: TranslationCapabilityFact): boolean {
  return fact.support !== 'unknown' && !isDeclaredEvidence(fact);
}

/** Durable writes accept equal-time observations, but never downgrade real evidence. */
export function canApplyCapabilityObservation(
  previous: TranslationCapabilityFact | undefined,
  observation: TranslationCapabilityFact,
): boolean {
  if (!previous) return true;
  if (previous.support !== 'unknown' && observation.support === 'unknown') return false;
  if (isObservedEvidence(previous) && !isObservedEvidence(observation)) return false;
  return previous.support === 'unknown' || observation.observedAt >= previous.observedAt;
}

/** A cache supplements durable knowledge only with strictly newer evidence. */
export function newerCachedCapabilityFacts(
  durable: Readonly<CapabilityFacts>,
  cached: Readonly<CapabilityFacts>,
): CapabilityFacts {
  return Object.fromEntries(Object.entries(cached).filter(([key, observation]) => {
    const previous = durable[key];
    if (!previous) return true;
    if (previous.support !== 'unknown' && observation.support === 'unknown') return false;
    if (!isDeclaredEvidence(previous) && isDeclaredEvidence(observation)) return false;
    return observation.observedAt > previous.observedAt;
  }));
}

/** Keep failed writes which still add knowledge after another request persists facts. */
export function unpersistedCapabilityFacts(
  durable: Readonly<CapabilityFacts>,
  cached: Readonly<CapabilityFacts>,
): CapabilityFacts {
  return Object.fromEntries(Object.entries(cached).filter(([key, observation]) => {
    const previous = durable[key];
    if (!previous) return true;
    return isObservedEvidence(observation) && (
      previous.support === 'unknown' ||
      isDeclaredEvidence(previous) ||
      observation.observedAt > previous.observedAt
    );
  }));
}

/** During an outage, retain known support or fresher non-default session evidence. */
export function recoverableCapabilityFacts(
  current: Readonly<CapabilityFacts>,
  cached: Readonly<CapabilityFacts>,
): CapabilityFacts {
  return Object.fromEntries(Object.entries(cached).filter(([key, observation]) => {
    const previous = current[key];
    if (!previous) return true;
    if (previous.support === 'unknown' && observation.support !== 'unknown') return true;
    return !isDeclaredEvidence(observation) && (
      isDeclaredEvidence(previous) || observation.observedAt > previous.observedAt
    );
  }));
}
