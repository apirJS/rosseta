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

export class SelectionBox {  private readonly element: HTMLDivElement;
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

  public update(rect: SelectionRect): void {
    const { left, top, width, height } = rect;

    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;

    const rightBorder = this.winWidth - (left + width);
    const bottomBorder = this.winHeight - (top + height);
    this.element.style.borderWidth = `${top}px ${rightBorder}px ${bottomBorder}px ${left}px`;

    this.updateCameraFrame(width, height);
  }

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
