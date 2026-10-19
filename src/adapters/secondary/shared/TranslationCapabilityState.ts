import type {
  ITranslationCapabilityStorage,
  TranslationCapabilityReadContext,
  TranslationCapabilityFact,
  TranslationCapabilitySupport,
} from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import { GENERATION_MODES, type GenerationMode } from './ITranslationGenerationTransport';
import { TranslationCapabilityJournal } from './TranslationCapabilityJournal';
import type { CapabilityFacts } from './translation-capability-facts';
import { migrateLegacyCapabilities } from './translation-capability-migration';
import { isStructured, isStreamed } from './translation-fallback';

type UnsupportedFeature = 'structured' | 'stream' | 'combination' | 'vision';

/** Translate provider observations into model- and schema-specific mode support. */
export class TranslationCapabilityState {
  private readonly journal: TranslationCapabilityJournal;
  private allowedModes: ReadonlySet<GenerationMode> | undefined;

  constructor(
    readonly identity: string,
    private readonly schemaScope: string,
    private readonly storage: ITranslationCapabilityStorage,
    refreshContext?: TranslationCapabilityReadContext,
  ) {
    this.journal = new TranslationCapabilityJournal(identity, storage, refreshContext);
  }

  async load(legacyModelKey?: string, unambiguous = false): Promise<void> {
    await this.journal.load();
    if (legacyModelKey && unambiguous) await this.importLegacyFacts(legacyModelKey);
    await this.recordUnknownDefaults();
  }

  imageUnsupported(): boolean {
    return this.applicable('feature.image') === 'unsupported';
  }

  support(mode: GenerationMode): TranslationCapabilitySupport {
    if (this.imageUnsupported()) return 'unsupported';
    if (isStructured(mode) && this.applicable('feature.structured') === 'unsupported') return 'unsupported';
    if (isStreamed(mode) && this.applicable('feature.stream') === 'unsupported') return 'unsupported';
    if (this.allowedModes && !this.allowedModes.has(mode)) return 'unsupported';
    return this.applicable(this.modeKey(mode));
  }

  async declareModes(allowed: readonly GenerationMode[]): Promise<void> {
    // Adapter constraints describe the installed transport, not observations
    // about a provider model. Recompute them for each request so an SDK upgrade
    // can add modes without old durable :transport exclusions blocking them.
    this.allowedModes = new Set(allowed);
  }

  async accepted(mode: GenerationMode, schemaValidated: boolean, imageAccepted = true): Promise<void> {
    const facts: CapabilityFacts = {};
    if (!isStructured(mode) || schemaValidated) {
      facts[this.modeKey(mode)] = this.fact('supported', 'observed-completion', this.modeScope(mode));
    }
    if (isStreamed(mode)) facts['feature.stream'] = this.fact('supported', 'observed-completion');
    if (schemaValidated && isStructured(mode)) {
      facts['feature.structured'] = this.fact('supported', 'observed-completion');
    }
    if (imageAccepted) facts['feature.image'] = this.fact('supported', 'observed-completion');
    await this.journal.record(facts);
  }

  async rejected(mode: GenerationMode, kind: UnsupportedFeature, general = false): Promise<void> {
    const key = this.rejectedFactKey(mode, kind, general);
    const scope = key.startsWith('feature.') ? 'model' : this.modeScope(mode);
    await this.journal.record({ [key]: this.fact('unsupported', 'explicit-provider', scope) });
  }

  private async importLegacyFacts(modelKey: string): Promise<void> {
    const imported = await migrateLegacyCapabilities(this.storage, {
      identity: this.identity, modelKey, unambiguous: true,
      factKey: 'feature.structured', scope: 'model',
      context: this.journal.scopeContext,
    });
    if (imported.success && imported.data) this.journal.adoptMigration(imported.data);
  }

  private async recordUnknownDefaults(): Promise<void> {
    const keys = [
      'feature.image', 'feature.structured', 'feature.stream',
      ...GENERATION_MODES.map(mode => this.modeKey(mode)),
    ];
    const defaults: CapabilityFacts = {};
    for (const key of keys) {
      if (!(key in this.journal.facts)) {
        defaults[key] = {
          support: 'unknown', source: 'default', observedAt: 0,
          scope: key.includes(this.schemaScope) ? this.schemaScope : 'model',
        };
      }
    }
    if (Object.keys(defaults).length) await this.journal.record(defaults);
  }

  private rejectedFactKey(mode: GenerationMode, kind: UnsupportedFeature, general: boolean): string {
    if (kind === 'vision') return 'feature.image';
    if (general && kind === 'structured') return 'feature.structured';
    if (general && kind === 'stream') return 'feature.stream';
    return this.modeKey(mode);
  }

  private applicable(key: string): TranslationCapabilitySupport {
    return this.journal.facts[key]?.support ?? 'unknown';
  }

  private modeKey(mode: GenerationMode): string {
    return isStructured(mode) ? `mode.${mode}:${this.schemaScope}` : `mode.${mode}`;
  }

  private modeScope(mode: GenerationMode): string {
    return isStructured(mode) ? this.schemaScope : 'model';
  }

  private fact(
    support: TranslationCapabilitySupport,
    source: string,
    scope = 'model',
  ): TranslationCapabilityFact {
    return { support, source, scope, observedAt: Date.now() };
  }
}
