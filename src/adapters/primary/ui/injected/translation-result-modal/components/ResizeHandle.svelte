<script lang="ts">
  import { onDestroy } from 'svelte';
  import { SectionResizeController } from './SectionResizeController';

  interface Props {
    box: HTMLElement;
    minHeight: number;
    ariaLabel: string;
    onresizestart?: () => void;
    onresizeend?: () => void;
  }

  const { box, minHeight, ariaLabel, onresizestart, onresizeend }: Props =
    $props();

  const controller = new SectionResizeController(() => ({
    box,
    minHeight,
    onresizestart,
    onresizeend,
  }));

  onDestroy(controller.dispose);
</script>

<button
  type="button"
  class="resize-handle"
  aria-label={ariaLabel}
  onpointerdown={controller.start}
></button>
