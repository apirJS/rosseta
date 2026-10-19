import { z } from 'zod';
import type { TranslationCapabilityRecord } from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import {
  canApplyCapabilityObservation,
  cloneCapabilityRecord,
  type CapabilityFacts,
} from '../shared/translation-capability-facts';

const factSchema = z.object({
  support: z.enum(['unknown', 'supported', 'unsupported']),
  source: z.string(),
  observedAt: z.number().finite().nonnegative(),
  scope: z.string(),
});

const recordSchema = z.object({
  identity: z.string().min(1),
  generation: z.number().int().nonnegative(),
  facts: z.record(z.string(), factSchema),
  legacyCleared: z.boolean(),
  namespace: z.string().min(1).optional(),
  namespaceGeneration: z.number().int().nonnegative().optional(),
  refreshedAt: z.number().finite().nonnegative().optional(),
});

const envelopeSchema = z.object({
  version: z.literal(1),
  records: z.unknown(),
  namespaces: z.unknown().optional(),
});

export interface CapabilityStorageEnvelope {
  records: Record<string, TranslationCapabilityRecord>;
  namespaces: Record<string, number>;
}

export function decodeCapabilityEnvelope(raw: unknown): CapabilityStorageEnvelope {
  return { records: decodeCapabilityRecords(raw), namespaces: decodeCapabilityNamespaces(raw) };
}

function decodeCapabilityNamespaces(raw: unknown): Record<string, number> {
  const namespaces: Record<string, number> = Object.create(null);
  const parsed = envelopeSchema.safeParse(raw);
  const entries = parsed.success ? parsed.data.namespaces : undefined;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return namespaces;
  for (const [key, generation] of Object.entries(entries)) {
    if (typeof generation === 'number' && Number.isSafeInteger(generation) && generation >= 0) {
      namespaces[key] = generation;
    }
  }
  return namespaces;
}

/** Isolate corrupt records without deleting any other model's valid knowledge. */
export function decodeCapabilityRecords(
  raw: unknown,
): Record<string, TranslationCapabilityRecord> {
  const records: Record<string, TranslationCapabilityRecord> =
    Object.create(null);
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) return records;

  const entries = envelope.data.records;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries))
    return records;

  for (const [key, value] of Object.entries(entries)) {
    const parsed = recordSchema.safeParse(value);
    if (parsed.success && parsed.data.identity === key)
      records[key] = parsed.data;
  }
  return records;
}

export function mergeCapabilityRecord(
  current: TranslationCapabilityRecord,
  observations: Readonly<CapabilityFacts>,
): TranslationCapabilityRecord {
  const merged = cloneCapabilityRecord(current);
  for (const [key, observation] of Object.entries(observations)) {
    const parsed = factSchema.safeParse(observation);
    if (
      !parsed.success ||
      !canApplyCapabilityObservation(merged.facts[key], observation)
    )
      continue;

    Object.defineProperty(merged.facts, key, {
      value: { ...parsed.data },
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return merged;
}
