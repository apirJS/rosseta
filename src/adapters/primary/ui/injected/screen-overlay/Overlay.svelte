<script lang="ts">
  import { OverlayController } from './OverlayController.svelte';

  interface Props {
    viewportImg: string;
    captureWidth: number;
    detachOverlay: () => void;
    onReady?: () => void;
  }
  const { viewportImg, captureWidth, detachOverlay, onReady }: Props = $props();

  const controller = new OverlayController(viewportImg, detachOverlay, onReady);

  let overlayEl: HTMLDivElement;

  $effect(() => {
    if (overlayEl) {
      controller.setContainer(overlayEl);
    }
  });
</script>

<svelte:window onkeydown={controller.handleKeydown} />

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
