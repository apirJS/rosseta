import { writeToClipboard } from './write-to-clipboard';

export type CopyTarget = 'original' | 'translated' | 'description';
export type CopyState = 'idle' | 'copied';

/** Owns clipboard feedback; the modal decides which content is safe to copy. */
export class TranslationCopyController {
  public states = $state<Record<CopyTarget, CopyState>>({
    original: 'idle',
    translated: 'idle',
    description: 'idle',
  });

  private readonly timers = new Map<
    CopyTarget,
    ReturnType<typeof setTimeout>
  >();
  private revision = 0;
  private disposed = false;

  public async copy(target: CopyTarget, text: string): Promise<void> {
    if (this.disposed) return;

    const revision = this.revision;
    const copied = await writeToClipboard(text);

    if (!copied || this.disposed || revision !== this.revision) return;

    const previous = this.timers.get(target);

    if (previous) clearTimeout(previous);
    this.states[target] = 'copied';

    this.timers.set(
      target,
      setTimeout(() => {
        this.states[target] = 'idle';
        this.timers.delete(target);
      }, 2_000),
    );
  }

  public reset(): void {
    this.revision++;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.states = { original: 'idle', translated: 'idle', description: 'idle' };
  }

  public dispose(): void {
    this.disposed = true;
    this.reset();
  }
}
