import type { IndexedSegmentPayload } from '../translation-modal-segments';

interface TextSectionOptions {
  blocks: IndexedSegmentPayload[][];
  onSegmentIndexHover?: (index: number | null) => void;
}

export class TextSectionController {
  private resizing = false;

  constructor(private readonly options: () => TextSectionOptions) {}

  public get romanizedBlocks(): IndexedSegmentPayload[][] {
    return this.options().blocks.filter((block) =>
      block.some((segment) => segment.romanization),
    );
  }

  public handleSegmentPointer = (event: PointerEvent): void => {
    if (this.resizing || !(event.target instanceof Element)) return;

    const segment = event.target.closest<HTMLElement>('[data-seg-index]');

    if (!segment) return;

    const index = Number(segment.dataset.segIndex);

    if (Number.isInteger(index) && index >= 0) {
      this.options().onSegmentIndexHover?.(index);
    }
  };

  public handleSegmentLeave = (): void => {
    if (!this.resizing) this.options().onSegmentIndexHover?.(null);
  };

  public startResize = (): void => {
    this.resizing = true;
    this.options().onSegmentIndexHover?.(null);
  };

  public endResize = (): void => {
    this.resizing = false;
  };
}
