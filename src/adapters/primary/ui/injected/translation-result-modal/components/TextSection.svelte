<script lang="ts">
  import type { IndexedSegmentPayload } from '../translation-modal-segments';
  import ResizeHandle from './ResizeHandle.svelte';
  import TextBlocks from './TextBlocks.svelte';
  import RomanizationBlocks from './RomanizationBlocks.svelte';
  import { TextSectionController } from './TextSectionController';

  interface Props {
    blocks: IndexedSegmentPayload[][];
    langColorMap: Map<string, number>;
    isMultiLang: boolean;
    hasRomanization: boolean;
    highlightIndex?: number | null;
    onSegmentIndexHover?: (index: number | null) => void;
    pending?: boolean;
  }

  const {
    blocks,
    langColorMap,
    isMultiLang,
    hasRomanization,
    highlightIndex = null,
    onSegmentIndexHover,
    pending = false,
  }: Props = $props();

  let textBoxEl = $state<HTMLDivElement>();

  const controller = new TextSectionController(() => ({
    blocks,
    onSegmentIndexHover,
  }));
</script>

<div class="text-box" bind:this={textBoxEl}>
  <div
    class="text-content"
    role="group"
    onpointerenter={controller.handleSegmentPointer}
    onpointermove={controller.handleSegmentPointer}
    onpointerleave={controller.handleSegmentLeave}
  >
    <TextBlocks
      {blocks}
      {langColorMap}
      {isMultiLang}
      {highlightIndex}
      {pending}
    />
  </div>
  {#if hasRomanization}
    <div
      class="text-romanization"
      role="group"
      onpointerenter={controller.handleSegmentPointer}
      onpointermove={controller.handleSegmentPointer}
      onpointerleave={controller.handleSegmentLeave}
    >
      <RomanizationBlocks
        blocks={controller.romanizedBlocks}
        {highlightIndex}
      />
    </div>
  {/if}
</div>
{#if textBoxEl}
  <ResizeHandle
    box={textBoxEl}
    minHeight={60}
    ariaLabel="Resize text section"
    onresizestart={controller.startResize}
    onresizeend={controller.endResize}
  />
{/if}
