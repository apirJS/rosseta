import { sendMessageToRuntime } from '../../../../../shared/messaging';
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
    private onReady?: () => void,
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
    if (e.key === 'Escape') this.detachOverlay();
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

    const handlePointerMove = (e: PointerEvent) => {
      currentX = Math.max(0, Math.min(e.clientX, winWidth));
      currentY = Math.max(0, Math.min(e.clientY, winHeight));

      if (rafId === null) {
        rafId = requestAnimationFrame(updateBox);
      }
    };

    const handlePointerUp = async (e: PointerEvent) => {
      if (rafId !== null) cancelAnimationFrame(rafId);

      this.isPointerMoving = false;
      selectionBox.unmount();

      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerUp);
      target.releasePointerCapture(e.pointerId);

      const finalX = Math.max(0, Math.min(e.clientX, winWidth));
      const finalY = Math.max(0, Math.min(e.clientY, winHeight));

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
    try {
      const cropped = await this.cropImage(
        this.viewportImg,
        left,
        top,
        width,
        height,
      );

      this.detachOverlay();

      await sendMessageToRuntime({
        action: 'TRANSLATE_IMAGE',
        payload: {
          imageBase64: cropped,
        },
      });
    } catch (error) {
      console.error('Failed to crop image:', error);
    }
  }

  private static readonly MAX_CROP_DIMENSION = 1500;

  private cropImage(
    sourceUrl: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        const scaleX = img.naturalWidth / window.innerWidth;
        const scaleY = img.naturalHeight / window.innerHeight;

        let cropW = width * scaleX;
        let cropH = height * scaleY;

        const maxDim = OverlayController.MAX_CROP_DIMENSION;
        if (cropW > maxDim || cropH > maxDim) {
          const ratio = Math.min(maxDim / cropW, maxDim / cropH);
          cropW = Math.round(cropW * ratio);
          cropH = Math.round(cropH * ratio);
        }

        canvas.width = cropW;
        canvas.height = cropH;

        ctx.drawImage(
          img,
          x * scaleX,
          y * scaleY,
          width * scaleX,
          height * scaleY,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (e) => reject(e);
      img.src = sourceUrl;
    });
  }
}
