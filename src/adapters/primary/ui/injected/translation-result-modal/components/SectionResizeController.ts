import { startSectionResize } from './section-resize';

interface SectionResizeOptions {
  box: HTMLElement;
  minHeight: number;
  onresizestart?: () => void;
  onresizeend?: () => void;
}

export class SectionResizeController {
  private stopResize?: () => void;
  private disposed = false;

  constructor(private readonly options: () => SectionResizeOptions) {}

  public start = (event: PointerEvent): void => {
    if (this.disposed || event.button !== 0) return;
    this.stopResize?.();

    const { box, minHeight, onresizestart, onresizeend } = this.options();

    onresizestart?.();

    this.stopResize = startSectionResize({
      event,
      box,
      minHeight,
      onEnd: () => {
        this.stopResize = undefined;
        onresizeend?.();
      },
    });
  };

  public dispose = (): void => {
    this.disposed = true;
    this.stopResize?.();
    this.stopResize = undefined;
  };
}
