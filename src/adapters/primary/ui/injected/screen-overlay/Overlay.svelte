<script lang="ts">
  import { OverlayController } from './OverlayController.svelte';

  interface Props {
    viewportImg: string;
    captureWidth: number;
    detachOverlay: () => void;
    onReady?: () => void;
    startTranslation: (requestId: string, imageBase64: string) => Promise<void>;
  }
  const { viewportImg, captureWidth, detachOverlay, onReady, startTranslation }: Props = $props();

  // svelte-ignore state_referenced_locally
  const controller = new OverlayController(viewportImg, detachOverlay, onReady, startTranslation);

  let overlayEl: HTMLDivElement;

  $effect(() => {
    if (overlayEl) {
      controller.setContainer(overlayEl);
    }
  });
</script>

<svelte:window onkeydowncapture={controller.handleKeydown} />

<div
  bind:this={overlayEl}
  role="dialog"
  tabindex="-1"
  id="overlay"
  class="bg-no-repeat absolute inset-0 bg-top-left cursor-crosshair"
  style:background-image={controller.backgroundStyle}
  style:background-size="{captureWidth}px 100vh"
  style:touch-action="none"
  style:opacity={controller.isReady ? 1 : 0}
  style:transition="opacity 80ms ease-out"
  onpointerdown={controller.handlePointerDown}
></div>
