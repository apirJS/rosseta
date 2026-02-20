import { CSS_MAX_Z_INDEX } from '../../shared/constants/ui';

interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const FRAME_COLOR = 'oklch(54.6% 0.245 262.881)';
const FRAME_WIDTH = '1.5px';
const FRAME_LENGTH = 20;

/**
 * Handles the visual selection box overlay with camera-frame style corners.
 * Manages DOM creation, styling, and updates during drag selection.
 *
 * The element is mounted inside the provided container (typically a Shadow DOM host)
 * to isolate it from host page styles and event interference.
 */
export class SelectionBox {
  private readonly element: HTMLDivElement;
  private readonly winWidth: number;
  private readonly winHeight: number;
  private readonly frameGradient: string;
  private readonly frameThickness: string;
  private readonly frameLength: number;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.winWidth = window.innerWidth;
    this.winHeight = window.innerHeight;

    this.frameGradient = `linear-gradient(${FRAME_COLOR}, ${FRAME_COLOR})`;
    this.frameThickness = FRAME_WIDTH;
    this.frameLength = FRAME_LENGTH;

    this.element = this.createElement();
  }

  private createElement(): HTMLDivElement {
    const box = document.createElement('div');

    box.classList.add('selection-box');
    box.style.position = 'fixed';
    box.style.top = '0px';
    box.style.left = '0px';
    box.style.width = '0px';
    box.style.height = '0px';
    // CRITICAL: The border-based positioning technique requires content-box.
    // Borders must be additive to the content dimensions, not eat into them.
    // Without this, Tailwind's reset (border-box) or host page CSS collapses
    // the content area to 0, breaking the selection hole and coordinates.
    box.style.boxSizing = 'content-box';
    box.style.borderStyle = 'solid';
    box.style.borderColor = 'rgba(0, 0, 0, 0.4)';
    box.style.cursor = 'crosshair';
    box.style.zIndex = CSS_MAX_Z_INDEX;
    box.style.backgroundPosition =
      'top left, top left, top right, top right, bottom left, bottom left, bottom right, bottom right';
    box.style.backgroundRepeat = 'no-repeat';

    return box;
  }

  /**
   * Updates the selection box dimensions and border mask.
   */
  public update(rect: SelectionRect): void {
    const { left, top, width, height } = rect;

    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;

    const rightBorder = this.winWidth - (left + width);
    const bottomBorder = this.winHeight - (top + height);
    this.element.style.borderWidth = `${top}px ${rightBorder}px ${bottomBorder}px ${left}px`;

    this.updateCameraFrame(width, height);
  }

  /**
   * Updates the camera-frame corner backgrounds based on current dimensions.
   */
  private updateCameraFrame(width: number, height: number): void {
    const hLen = Math.min(this.frameLength, width / 3);
    const vLen = Math.min(this.frameLength, height / 3);

    const g = this.frameGradient;
    const t = this.frameThickness;

    this.element.style.backgroundImage = `${g}, ${g}, ${g}, ${g}, ${g}, ${g}, ${g}, ${g}`;
    this.element.style.backgroundSize = `${hLen}px ${t}, ${t} ${vLen}px, ${hLen}px ${t}, ${t} ${vLen}px, ${hLen}px ${t}, ${t} ${vLen}px, ${hLen}px ${t}, ${t} ${vLen}px`;
  }

  public mount(): void {
    this.container.appendChild(this.element);
  }

  public unmount(): void {
    this.element.remove();
  }

  public getViewportDimensions(): { width: number; height: number } {
    return { width: this.winWidth, height: this.winHeight };
  }
}
