<script lang="ts">
  import type { IndexedSegmentPayload } from '../translation-modal-segments';

  interface Props {
    blocks: IndexedSegmentPayload[][];
    langColorMap: Map<string, number>;
    isMultiLang: boolean;
    highlightIndex: number | null;
    pending: boolean;
  }

  const { blocks, langColorMap, isMultiLang, highlightIndex, pending }: Props =
    $props();
</script>

{#each blocks as block (block[0].rowKey ?? block[0].index)}
  <span class="text-block">
    {#each block as segment (segment.rowKey ?? segment.index)}
      <span
        data-seg-index={segment.index}
        class="text-segment {isMultiLang
          ? 'lang-gray-' + langColorMap.get(segment.language.code)
          : ''}"
        class:seg-highlight={highlightIndex === segment.index}
      >
        {segment.text || (pending ? '…' : '')}
      </span>{' '}
    {/each}
  </span>
{/each}
{#if blocks.length === 0 && pending}
  <span class="translation-pending">Waiting for text…</span>
{/if}
