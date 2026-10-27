<script lang="ts">
  import { onMount } from 'svelte';
  import { OverlayController } from './OverlayController.svelte';
  import SelectionRectangle from './SelectionRectangle.svelte';

  interface Props {
    viewportImg: string;
    captureWidth: number;
    detachOverlay: () => void;
    onReady?: () => void;
    startTranslation: (requestId: string, imageBase64: string) => Promise<void>;
  }

  let {
    viewportImg,
    captureWidth,
    detachOverlay,
    onReady,
    startTranslation,
  }: Props = $props();

  const controller = new OverlayController({
    image: () => viewportImg,
    detach: () => detachOverlay(),
    onReady: () => onReady?.(),
    startTranslation: (requestId, image) => startTranslation(requestId, image),
  });

  onMount(controller.mount);
</script>

<svelte:window onkeydowncapture={controller.handleKeydown} />

<div
  role="dialog"
  aria-label="Select an area to translate"
  tabindex="-1"
  id="overlay"
  class="bg-no-repeat absolute inset-0 bg-top-left cursor-crosshair"
  style:background-image={controller.backgroundStyle}
  style:background-size="{captureWidth}px 100vh"
  style:touch-action="none"
  style:opacity={controller.isReady ? 1 : 0}
  style:transition="opacity 80ms ease-out"
  onpointerdown={controller.selection.start}
  onpointermove={controller.selection.move}
  onpointerup={controller.selection.finish}
  onpointercancel={controller.selection.cancelPointer}
  onlostpointercapture={controller.selection.cancelPointer}
>
  {#if controller.selection.bounds}
    <SelectionRectangle
      bounds={controller.selection.bounds}
      viewport={controller.selection.viewport}
    />
  {/if}
</div>
