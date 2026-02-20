import { sendMessageToRuntime } from '../../../../../shared/messaging';
import { SelectionBox } from './SelectionBox';

export class OverlayController {
  public blobUrl = $state<string | null>(null);
  public isPointerMoving = $state<boolean>(false);
  public isReady = $state<boolean>(false);

  // Use the data URL directly for instant first paint (no blink).
  // The blob URL replaces it once loaded for better memory efficiency.
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

      // Pre-decode the data URL so the browser has the pixels ready
      // before we reveal the overlay. This eliminates the dark-flash blink.
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

  /**
   * Called by the Overlay component to provide a reference to the container
   * element inside the Shadow DOM. This allows SelectionBox to mount there
   * instead of document.body, keeping it isolated from host page interference.
   */
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

    // Use pointer capture so that ALL subsequent pointermove/pointerup events
    // are delivered to THIS element, regardless of what the host page does.
    target.setPointerCapture(e.pointerId);

    this.isPointerMoving = true;

    // Mount the SelectionBox inside the shadow DOM container (or fall back to document.body)
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

      if (width > 0 && height > 0) {
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

      // Remove the overlay immediately after selection
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

  /**
   * Max dimension for the cropped image sent to Gemini.
   * Larger images are scaled down — Gemini doesn't need 4K for OCR.
   */
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

        // Scale factor handles devicePixelRatio (Retina displays)
        const scaleX = img.naturalWidth / window.innerWidth;
        const scaleY = img.naturalHeight / window.innerHeight;

        let cropW = width * scaleX;
        let cropH = height * scaleY;

        // Downscale if either dimension exceeds the limit
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

        // JPEG at 80% quality — ~5-10x smaller than PNG
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (e) => reject(e);
      img.src = sourceUrl;
    });
  }
}
