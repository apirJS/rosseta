<script lang="ts">
  import { startSectionResize } from './section-resize';

  interface Props {
    box: HTMLElement;
    minHeight: number;
    ariaLabel: string;
    onresizestart?: () => void;
    onresizeend?: () => void;
  }

  const {
    box,
    minHeight,
    ariaLabel,
    onresizestart,
    onresizeend,
  }: Props = $props();

  function handlePointerDown(e: PointerEvent) {
    onresizestart?.();
    startSectionResize({ event: e, box, minHeight, onEnd: onresizeend });
  }
</script>

<button
  type="button"
  class="resize-handle"
  aria-label={ariaLabel}
  onpointerdown={handlePointerDown}
></button>
