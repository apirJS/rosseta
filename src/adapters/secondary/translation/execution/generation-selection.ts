import type { TranslationCapabilitySupport } from '../../../../core/ports/outbound/ITranslationCapabilityStorage';
import type {
  GenerationConfiguration,
  GenerationRoute,
} from '../transports/GenerationTransport';
import {
  GENERATION_MODES,
  bufferedMode,
  isStreamed,
  type GenerationMode,
} from '../transports/generation-modes';

type ModeRejection = 'structured' | 'stream' | 'combination';

interface PhaseSelectionOptions {
  preferredMode?: GenerationMode;
  configurationFallbackMode?: GenerationMode;
}

/** Route navigation only: compatibility remains live, with no I/O or budgets. */
export class GenerationSelection {
  private readonly visitedConfigurations = new Set<string>();
  private readonly visitedModes = new Set<GenerationMode>();
  private allowedModes: ReadonlySet<GenerationMode> = new Set();
  private selected: GenerationConfiguration | undefined;

  constructor(
    private readonly configurations: readonly GenerationConfiguration[] = [],
    private readonly configurationSupport: (
      id: string,
    ) => TranslationCapabilitySupport,
    private readonly modeSupport: (
      mode: GenerationMode,
      configurationId?: string,
    ) => TranslationCapabilitySupport,
  ) {}

  get currentConfiguration(): GenerationConfiguration | undefined {
    return this.selected;
  }

  beginPhase(
    allowedModes: readonly GenerationMode[],
    options: PhaseSelectionOptions = {},
  ): GenerationRoute | null {
    this.allowedModes = new Set(allowedModes);
    this.visitedModes.clear();

    if (this.configurations.length && !this.selected)
      this.selected = this.chooseConfiguration();

    const mode = this.selectMode(options.preferredMode);

    return mode
      ? this.route(mode)
      : this.advanceConfiguration(options.configurationFallbackMode);
  }

  recordAttempt(mode: GenerationMode): void {
    this.visitedModes.add(mode);
  }

  afterConfigurationRejection(
    previousMode: GenerationMode,
  ): GenerationRoute | null {
    return this.advanceConfiguration(previousMode);
  }

  afterModeRejection(
    mode: GenerationMode,
    reason: ModeRejection,
    options: { advanceConfiguration?: boolean } = {},
  ): GenerationRoute | null {
    const preferred =
      reason === 'stream'
        ? bufferedMode(mode)
        : isStreamed(mode)
          ? 'plain-stream'
          : 'plain-buffered';

    const selected = this.selectMode(preferred);

    if (selected) return this.route(selected);

    return options.advanceConfiguration
      ? this.advanceConfiguration(mode)
      : null;
  }

  bufferedRestart(mode: GenerationMode): GenerationRoute | null {
    const corresponding = bufferedMode(mode);

    // A restart can repeat the current buffered route despite its visitation.
    if (this.eligible(corresponding)) return this.route(corresponding);

    const alternative = this.selectMode(
      undefined,
      GENERATION_MODES.filter((candidate) => !isStreamed(candidate)),
    );

    return alternative ? this.route(alternative) : null;
  }

  private advanceConfiguration(
    previousMode?: GenerationMode,
  ): GenerationRoute | null {
    if (!this.selected) return null;

    this.visitedConfigurations.add(this.selected.id);
    this.selected = this.chooseConfiguration();
    this.visitedModes.clear();

    if (previousMode && this.eligible(previousMode))
      return this.route(previousMode);

    const mode = this.selectMode();

    return mode ? this.route(mode) : null;
  }

  private chooseConfiguration(): GenerationConfiguration | undefined {
    const eligible = this.configurations.filter(
      (configuration) =>
        !this.visitedConfigurations.has(configuration.id) &&
        GENERATION_MODES.some((mode) => this.eligible(mode, configuration.id)),
    );

    return (
      eligible.find(
        (configuration) =>
          this.configurationSupport(configuration.id) === 'supported',
      ) ?? eligible[0]
    );
  }

  private selectMode(
    preferred?: GenerationMode,
    candidates: readonly GenerationMode[] = GENERATION_MODES,
  ): GenerationMode | null {
    const available = candidates.filter(
      (mode) => !this.visitedModes.has(mode) && this.eligible(mode),
    );

    const knownWorking = available.find(
      (mode) => this.modeSupport(mode, this.selected?.id) === 'supported',
    );

    if (knownWorking) return knownWorking;
    if (preferred && available.includes(preferred)) return preferred;

    return available[0] ?? null;
  }

  private eligible(
    mode: GenerationMode,
    configurationId = this.selected?.id,
  ): boolean {
    if (this.configurations.length && configurationId === undefined)
      return false;
    if (
      configurationId !== undefined &&
      this.configurationSupport(configurationId) === 'unsupported'
    )
      return false;

    return (
      this.allowedModes.has(mode) &&
      this.modeSupport(mode, configurationId) !== 'unsupported'
    );
  }

  private route(mode: GenerationMode): GenerationRoute {
    return {
      mode,
      ...(this.selected ? { configurationId: this.selected.id } : {}),
    };
  }
}
