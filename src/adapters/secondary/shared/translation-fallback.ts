import { GENERATION_MODES, type GenerationMode } from './ITranslationGenerationTransport';
import type { GenerationFailure } from './generation-errors';

type ModeSupport = 'unknown' | 'supported' | 'unsupported';
type SupportLookup = (mode: GenerationMode) => ModeSupport;
const MAX_GENERATION_CALLS = 6;

export const isStructured = (mode: GenerationMode) => mode.startsWith('structured');
export const isStreamed = (mode: GenerationMode) => mode.endsWith('stream');

export function bufferedMode(mode: GenerationMode): GenerationMode {
  return isStructured(mode) ? 'structured-buffered' : 'plain-buffered';
}

export function selectGenerationMode(
  support: SupportLookup,
  visited: ReadonlySet<GenerationMode>,
  preferred?: GenerationMode,
): GenerationMode | null {
  const available = GENERATION_MODES.filter(mode => {
    return !visited.has(mode) && support(mode) !== 'unsupported';
  });
  const knownWorking = available.find(mode => support(mode) === 'supported');
  if (knownWorking) return knownWorking;
  if (preferred && available.includes(preferred)) return preferred;
  return available[0] ?? null;
}

/** Per-job mode navigation and invocation budgets; no transport or persistence. */
export class TranslationAttemptPolicy {
  private readonly visited = new Set<GenerationMode>();
  private calls = 0;
  private restarted = false;
  private repaired = false;
  private previousResponse: string | undefined;

  constructor(private readonly support: SupportLookup) {}

  get hasBudget(): boolean {
    return this.calls < MAX_GENERATION_CALLS;
  }

  get repairText(): string | undefined {
    return this.previousResponse;
  }

  initialMode(): GenerationMode | null {
    return selectGenerationMode(this.support, this.visited);
  }

  recordAttempt(mode: GenerationMode): void {
    this.calls++;
    this.visited.add(mode);
  }

  repair(text: string): GenerationMode | null {
    if (this.repaired) return null;
    const mode = this.support('plain-buffered') !== 'unsupported'
      ? 'plain-buffered'
      : this.support('structured-buffered') !== 'unsupported'
        ? 'structured-buffered'
        : null;
    if (!mode) return null;
    this.repaired = true;
    this.previousResponse = text;
    return mode;
  }

  afterFailure(mode: GenerationMode, failure: GenerationFailure): GenerationMode | null {
    if (this.repaired || failure.unsupported === 'vision') return null;
    if (failure.unsupported) {
      const preferred = failure.unsupported === 'stream'
        ? bufferedMode(mode)
        : isStreamed(mode) ? 'plain-stream' : 'plain-buffered';
      return selectGenerationMode(this.support, this.visited, preferred);
    }
    if (!failure.transient || this.restarted) return null;
    return this.restartBuffered(mode);
  }

  private restartBuffered(mode: GenerationMode): GenerationMode | null {
    const buffered = bufferedMode(mode);
    const selected = this.support(buffered) !== 'unsupported'
      ? buffered
      : selectGenerationMode(
        candidate => isStreamed(candidate) ? 'unsupported' : this.support(candidate),
        this.visited,
      );
    if (selected) this.restarted = true;
    return selected;
  }
}
