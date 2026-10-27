<script lang="ts">
  import type { SelectionBounds, SelectionViewport } from './selection-bounds';

  interface Props {
    bounds: SelectionBounds;
    viewport: SelectionViewport;
  }

  let { bounds, viewport }: Props = $props();
</script>

<div
  class="selection-box"
  aria-hidden="true"
  style:width="{bounds.width}px"
  style:height="{bounds.height}px"
  style:border-width="{bounds.top}px {viewport.width -
    bounds.left -
    bounds.width}px {viewport.height - bounds.top - bounds.height}px {bounds.left}px"
></div>

<style>
  .selection-box {
    position: fixed;
    inset: 0 auto auto 0;
    box-sizing: content-box;
    border-style: solid;
    border-color: rgba(0, 0, 0, 0.4);
    pointer-events: none;
  }

  .selection-box::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 1.5px dashed var(--selection-frame);
  }
</style>
