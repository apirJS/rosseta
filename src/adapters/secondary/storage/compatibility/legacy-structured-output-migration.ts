import * as browser from 'webextension-polyfill';
import type {
  ITranslationCapabilityStorage,
  TranslationCapabilityRecord,
} from '../../../../core/ports/outbound/ITranslationCapabilityStorage';
import { failure, success, type Result } from '../../../../shared/types/Result';
import { StorageError, type AppError } from '../../../../shared/errors';
import type { LegacyStructuredOutputMigration } from '../../translation/compatibility/translation-capability-migration';

const LEGACY_KEY = 'structuredOutputExemptModels';
let migrationOperation: Promise<void> = Promise.resolve();

/** Called only for a definitively matched endpoint. Ambiguous entries stay intact. */
export function migrateLegacyStructuredOutputExemption(
  storage: ITranslationCapabilityStorage,
  options: LegacyStructuredOutputMigration,
): Promise<Result<TranslationCapabilityRecord | null, AppError>> {
  const operation = migrationOperation.then(() => migrate(storage, options));

  migrationOperation = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

async function migrate(
  storage: ITranslationCapabilityStorage,
  options: LegacyStructuredOutputMigration,
): Promise<Result<TranslationCapabilityRecord | null, AppError>> {
  const existing = await storage.read(options.identity, options.context);

  if (!existing.success || !options.unambiguous) return existing;

  let raw: unknown;

  try {
    const values = await browser.storage.local.get(LEGACY_KEY);

    raw = values[LEGACY_KEY];
  } catch {
    return failure(StorageError.readFailed(LEGACY_KEY));
  }

  try {
    if (!Array.isArray(raw)) return existing;

    // Preserve valid exclusions even if unrelated entries were corrupted.
    const entries = raw.filter(
      (value): value is string => typeof value === 'string',
    );

    if (!entries.includes(options.modelKey)) return existing;

    if (existing.data?.legacyCleared) {
      await browser.storage.local.set({
        [LEGACY_KEY]: entries.filter((key) => key !== options.modelKey),
      });

      return existing;
    }

    const imported = await storage.merge(
      options.identity,
      existing.data?.generation ?? 0,
      {
        [options.factKey]: {
          support: 'unsupported',
          source: 'legacy-policy',
          observedAt: 0,
          scope: options.scope,
        },
      },
      options.context
        ? {
            ...options.context,
            namespaceGeneration: existing.data?.namespaceGeneration ?? 0,
          }
        : undefined,
    );

    if (!imported.success) return imported;

    // Only a successful capability write permits removing the old source entry.
    await browser.storage.local.set({
      [LEGACY_KEY]: entries.filter((key) => key !== options.modelKey),
    });

    return success(imported.data);
  } catch {
    return failure(StorageError.writeFailed(LEGACY_KEY));
  }
}
