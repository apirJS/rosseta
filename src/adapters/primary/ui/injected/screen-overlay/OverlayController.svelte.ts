import { SelectionBox } from './SelectionBox';

export class OverlayController {
  public blobUrl = $state<string | null>(null);
  public isPointerMoving = $state<boolean>(false);
  public isReady = $state<boolean>(false);

  public readonly backgroundStyle = $derived.by(() => {
    const url = this.blobUrl ?? this.viewportImg;

    return this.isPointerMoving
      ? `url(${url})`
      : `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${url})`;
  });

  private overlayContainer: HTMLElement | null = null;

  constructor(
    private viewportImg: string,
    private detachOverlay: () => void,
    private onReady: (() => void) | undefined,
    private readonly startTranslation: (
      requestId: string,
      imageBase64: string,
    ) => Promise<void>,
  ) {
    $effect(() => {
      let active = true;

      this.decodeImage(this.viewportImg).then(() => {
        if (active) {
          this.isReady = true;
          this.onReady?.();
        }
      });

      this.loadBlob(this.viewportImg).then((url) => {
        if (active) this.blobUrl = url;
      });

      return () => {
        active = false;
        if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
      };
    });
  }

  public setContainer(container: HTMLElement): void {
    this.overlayContainer = container;
  }

  private async decodeImage(src: string): Promise<void> {
    const img = new Image();

    img.src = src;
    await img.decode();
  }

  private async loadBlob(base64: string) {
    const res = await fetch(base64);
    const blob = await res.blob();

    return URL.createObjectURL(blob);
  }

  public handleKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    this.detachOverlay();
  };

  public handlePointerDown = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLElement;

    target.setPointerCapture(e.pointerId);

    this.isPointerMoving = true;

    const mountTarget = this.overlayContainer ?? document.body;
    const selectionBox = new SelectionBox(mountTarget);

    const { width: winWidth, height: winHeight } =
      selectionBox.getViewportDimensions();

    const initialX = e.clientX;
    const initialY = e.clientY;

    selectionBox.update({
      left: initialX,
      top: initialY,
      width: 0,
      height: 0,
    });

    selectionBox.mount();

    let rafId: number | null = null;
    let currentX = initialX;
    let currentY = initialY;

    const updateBox = () => {
      const width = Math.abs(currentX - initialX);
      const height = Math.abs(currentY - initialY);
      const left = Math.min(currentX, initialX);
      const top = Math.min(currentY, initialY);

      selectionBox.update({ left, top, width, height });
      rafId = null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      currentX = Math.max(0, Math.min(event.clientX, winWidth));
      currentY = Math.max(0, Math.min(event.clientY, winHeight));

      if (rafId === null) {
        rafId = requestAnimationFrame(updateBox);
      }
    };

    const handlePointerUp = async (event: PointerEvent) => {
      if (rafId !== null) cancelAnimationFrame(rafId);

      this.isPointerMoving = false;
      selectionBox.unmount();

      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerUp);
      target.releasePointerCapture(event.pointerId);

      const finalX = Math.max(0, Math.min(event.clientX, winWidth));
      const finalY = Math.max(0, Math.min(event.clientY, winHeight));

      const width = Math.abs(finalX - initialX);
      const height = Math.abs(finalY - initialY);
      const left = Math.min(finalX, initialX);
      const top = Math.min(finalY, initialY);

      const MIN_CROP_DIMENSION = 10;

      if (width >= MIN_CROP_DIMENSION && height >= MIN_CROP_DIMENSION) {
        await this.handleSelectionComplete(left, top, width, height);
      }
    };

    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerUp);
  };

  private async handleSelectionComplete(
    left: number,
    top: number,
    width: number,
    height: number,
  ): Promise<void> {
    let cropped: string;

    try {
      cropped = await this.cropImage(
        this.viewportImg,
        left,
        top,
        width,
        height,
      );
    } catch (error) {
      console.error('Failed to crop image:', error);

      return;
    }

    this.detachOverlay();

    const requestId = crypto.randomUUID();

    try {
      await this.startTranslation(requestId, cropped);
    } catch (error) {
      console.error('Failed to start translation:', error);
    }
  }

  private cropImage(
    sourceUrl: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.addEventListener('load', () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));

          return;
        }

        const scaleX = img.naturalWidth / window.innerWidth;
        const scaleY = img.naturalHeight / window.innerHeight;

        // Copy whole source pixels without resampling at fractional display scales.
        const cropX = Math.floor(x * scaleX);
        const cropY = Math.floor(y * scaleY);

        const cropW =
          Math.min(img.naturalWidth, Math.ceil((x + width) * scaleX)) - cropX;

        const cropH =
          Math.min(img.naturalHeight, Math.ceil((y + height) * scaleY)) - cropY;

        canvas.width = cropW;
        canvas.height = cropH;

        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        resolve(canvas.toDataURL('image/png'));
      });

      img.addEventListener('error', (event) => reject(event));
      img.src = sourceUrl;
    });
  }
}
