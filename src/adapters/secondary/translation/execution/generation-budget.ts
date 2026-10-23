const MAX_GENERATION_INVOCATIONS = 6;

/** Shared allowances for every initial, fallback and repair invocation. */
export class GenerationBudget {
  private invocations = 0;
  private restarted = false;

  get hasCapacity(): boolean {
    return this.invocations < MAX_GENERATION_INVOCATIONS;
  }

  get canRestart(): boolean {
    return !this.restarted;
  }

  recordInvocation(): void {
    if (!this.hasCapacity) throw new Error('Generation budget exhausted');

    this.invocations++;
  }

  consumeRestart(): void {
    if (!this.canRestart) throw new Error('Transport restart already consumed');

    this.restarted = true;
  }
}
