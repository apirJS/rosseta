import type { SelectionBounds, SelectionViewport } from './selection-bounds';

interface ActiveSelection {
  pointerId: number;
  target: HTMLElement;
  x: number;
  y: number;
}

const MINIMUM_SELECTION_SIZE = 10;

export class ScreenSelectionController {
  public bounds = $state<SelectionBounds | null>(null);
  public viewport = $state<SelectionViewport>({ width: 0, height: 0 });
  public readonly isSelecting = $derived(this.bounds !== null);
  private active: ActiveSelection | null = null;
  private frame?: number;
  private pendingPoint?: { x: number; y: number };

  constructor(
    private readonly onSelected: (
      bounds: SelectionBounds,
      viewport: SelectionViewport,
    ) => void | Promise<void>,
    private readonly canSelect: () => boolean = () => true,
  ) {}

  public start = (event: PointerEvent): void => {
    if (this.active || !this.canSelect() || event.button !== 0) return;
    this.viewport = { width: window.innerWidth, height: window.innerHeight };

    const point = this.clamp(event);
    const target = event.currentTarget as HTMLElement;

    target.setPointerCapture(event.pointerId);
    this.active = { pointerId: event.pointerId, target, ...point };
    this.bounds = { left: point.x, top: point.y, width: 0, height: 0 };
  };

  public move = (event: PointerEvent): void => {
    if (event.pointerId !== this.active?.pointerId) return;
    this.pendingPoint = this.clamp(event);
    if (this.frame !== undefined) return;

    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;

      if (this.active && this.pendingPoint) {
        this.bounds = this.measure(this.pendingPoint);
      }
    });
  };

  public finish = async (event: PointerEvent): Promise<void> => {
    if (event.pointerId !== this.active?.pointerId) return;

    const bounds = this.measure(this.clamp(event));
    const viewport = this.viewport;

    this.cancel();

    if (
      bounds.width >= MINIMUM_SELECTION_SIZE &&
      bounds.height >= MINIMUM_SELECTION_SIZE
    ) {
      await this.onSelected(bounds, viewport);
    }
  };

  public cancelPointer = (event: PointerEvent): void => {
    if (event.pointerId === this.active?.pointerId) this.cancel();
  };

  public cancel = (): void => {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.pendingPoint = undefined;

    const active = this.active;

    this.active = null;
    this.bounds = null;

    if (active?.target.hasPointerCapture(active.pointerId)) {
      active.target.releasePointerCapture(active.pointerId);
    }
  };

  private clamp(event: PointerEvent): { x: number; y: number } {
    return {
      x: Math.max(0, Math.min(event.clientX, this.viewport.width)),
      y: Math.max(0, Math.min(event.clientY, this.viewport.height)),
    };
  }

  private measure(point: { x: number; y: number }): SelectionBounds {
    const start = this.active!;

    return {
      left: Math.min(point.x, start.x),
      top: Math.min(point.y, start.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    };
  }
}
