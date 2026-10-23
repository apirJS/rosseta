<script lang="ts">
  import { onDestroy } from 'svelte';
  import { startSectionResize } from './section-resize';

  interface Props {
    box: HTMLElement;
    minHeight: number;
    ariaLabel: string;
    onresizestart?: () => void;
    onresizeend?: () => void;
  }

  const { box, minHeight, ariaLabel, onresizestart, onresizeend }: Props =
    $props();

  let stopResize: (() => void) | undefined;

  onDestroy(() => stopResize?.());

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    stopResize?.();
    onresizestart?.();

    stopResize = startSectionResize({
      event: e,
      box,
      minHeight,
      onEnd: onresizeend,
    });
  }
</script>

<button
  type="button"
  class="resize-handle"
  aria-label={ariaLabel}
  onpointerdown={handlePointerDown}
></button>
