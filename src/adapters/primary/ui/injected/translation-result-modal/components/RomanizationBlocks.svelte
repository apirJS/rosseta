<script lang="ts">
  import type { IndexedSegmentPayload } from '../translation-modal-segments';

  interface Props {
    blocks: IndexedSegmentPayload[][];
    highlightIndex: number | null;
  }

  const { blocks, highlightIndex }: Props = $props();
</script>

{#each blocks as block (block[0].rowKey ?? block[0].index)}
  <span class="text-block">
    {#each block as segment (segment.rowKey ?? segment.index)}
      {#if segment.romanization}
        <span
          data-seg-index={segment.index}
          class="rom-segment"
          class:rom-highlight={highlightIndex === segment.index}
        >
          {segment.romanization}
        </span>{' '}
      {/if}
    {/each}
  </span>
{/each}
