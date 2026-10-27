import { cropSelectionImage } from './crop-selection-image';
import { ScreenSelectionController } from './ScreenSelectionController.svelte';
import type { SelectionBounds, SelectionViewport } from './selection-bounds';

interface OverlayOptions {
  image: () => string;
  detach: () => void;
  onReady: () => void;
  startTranslation: (requestId: string, imageBase64: string) => Promise<void>;
}

export class OverlayController {
  public blobUrl = $state<string | null>(null);
  public isReady = $state(false);
  public isCropping = $state(false);
  public readonly selection = new ScreenSelectionController(
    (bounds, viewport) => this.translateSelection(bounds, viewport),
    () => this.isReady && !this.isCropping && !this.disposed,
  );
  public readonly backgroundStyle = $derived.by(() => {
    const image = `url(${this.blobUrl ?? this.options.image()})`;

    return this.selection.isSelecting
      ? image
      : `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), ${image}`;
  });
  private disposed = false;

  constructor(private readonly options: OverlayOptions) {}

  public mount = (): (() => void) => {
    const image = new Image();

    image.src = this.options.image();

    void image.decode().then(
      () => {
        if (this.disposed) return;
        this.isReady = true;
        this.options.onReady();
      },
      (error: unknown) => {
        if (this.disposed) return;
        console.error('Failed to load selection image:', error);
        this.close();
      },
    );

    void this.loadBlob();

    return this.dispose;
  };

  private async loadBlob(): Promise<void> {
    try {
      const response = await fetch(this.options.image());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (this.disposed) URL.revokeObjectURL(url);
      else this.blobUrl = url;
    } catch {
      return;
    }
  }

  public handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || this.disposed) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  };

  private async translateSelection(
    bounds: SelectionBounds,
    viewport: SelectionViewport,
  ): Promise<void> {
    this.isCropping = true;

    let image: string;

    try {
      image = await cropSelectionImage(this.options.image(), bounds, viewport);
    } catch (error) {
      if (!this.disposed) {
        this.isCropping = false;
        console.error('Failed to crop image:', error);
      }

      return;
    }

    if (this.disposed) return;
    this.close();

    try {
      await this.options.startTranslation(crypto.randomUUID(), image);
    } catch (error) {
      console.error('Failed to start translation:', error);
    }
  }

  private close(): void {
    if (this.disposed) return;
    this.dispose();
    this.options.detach();
  }

  public dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    this.selection.cancel();
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
    this.blobUrl = null;
  };
}
