import type {
  ITranslationCapabilityStorage,
  TranslationCapabilityReadContext,
  TranslationCapabilityRecord,
} from "../../../core/ports/outbound/ITranslationCapabilityStorage";
import type { AppError } from "../../../shared/errors";
import type { Result } from "../../../shared/types/Result";

export interface LegacyStructuredOutputMigration {
  identity: string;
  /** Reconstruct the whole legacy key; model IDs may themselves contain colons. */
  modelKey: string;
  unambiguous: boolean;
  factKey: string;
  scope: string;
  context?: TranslationCapabilityReadContext;
}

type LegacyMigration = (
  options: LegacyStructuredOutputMigration,
) => Promise<Result<TranslationCapabilityRecord | null, AppError>>;
const migrations = new WeakMap<
  ITranslationCapabilityStorage,
  LegacyMigration
>();

/** Browser storage registers its legacy reader without coupling native transports to browser modules. */
export function registerLegacyCapabilityMigration(
  storage: ITranslationCapabilityStorage,
  migration: LegacyMigration,
): void {
  migrations.set(storage, migration);
}

export function migrateLegacyCapabilities(
  storage: ITranslationCapabilityStorage,
  options: LegacyStructuredOutputMigration,
): Promise<Result<TranslationCapabilityRecord | null, AppError>> {
  return (
    migrations.get(storage)?.(options) ??
    storage.read(options.identity, options.context)
  );
}
