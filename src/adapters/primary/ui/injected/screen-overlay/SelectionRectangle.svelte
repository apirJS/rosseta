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
    background-image:
      linear-gradient(var(--selection-frame), var(--selection-frame)),
      linear-gradient(var(--selection-frame), var(--selection-frame)),
      linear-gradient(var(--selection-frame), var(--selection-frame)),
      linear-gradient(var(--selection-frame), var(--selection-frame)),
      linear-gradient(var(--selection-frame), var(--selection-frame)),
      linear-gradient(var(--selection-frame), var(--selection-frame)),
      linear-gradient(var(--selection-frame), var(--selection-frame)),
      linear-gradient(var(--selection-frame), var(--selection-frame));
    background-position:
      top left,
      top left,
      top right,
      top right,
      bottom left,
      bottom left,
      bottom right,
      bottom right;
    background-repeat: no-repeat;
    background-size:
      min(20px, 33.333333%) 1.5px,
      1.5px min(20px, 33.333333%),
      min(20px, 33.333333%) 1.5px,
      1.5px min(20px, 33.333333%),
      min(20px, 33.333333%) 1.5px,
      1.5px min(20px, 33.333333%),
      min(20px, 33.333333%) 1.5px,
      1.5px min(20px, 33.333333%);
  }
</style>
