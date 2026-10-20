<script lang="ts">
  import type { IndexedSegmentPayload } from '../translation-modal-segments';
  import ResizeHandle from './ResizeHandle.svelte';

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

  let isResizing = $state(false);

  function handleTextContentPointer(e: PointerEvent) {
    if (isResizing) return;

    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-seg-index]',
    );

    if (!target) return;

    const i = Number(target.dataset.segIndex);

    onSegmentIndexHover?.(i);
  }

  function handleTextContentLeave() {
    if (isResizing) return;
    onSegmentIndexHover?.(null);
  }

  function handleRomPointer(e: PointerEvent) {
    if (isResizing) return;

    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-seg-index]',
    );

    if (!target) return;

    const i = Number(target.dataset.segIndex);

    onSegmentIndexHover?.(i);
  }

  function handleRomLeave() {
    if (isResizing) return;
    onSegmentIndexHover?.(null);
  }
</script>

<div class="text-box" bind:this={textBoxEl}>
  <div
    class="text-content"
    role="group"
    onpointerenter={handleTextContentPointer}
    onpointermove={handleTextContentPointer}
    onpointerleave={handleTextContentLeave}
  >
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
  </div>
  {#if hasRomanization}
    <div
      class="text-romanization"
      role="group"
      onpointerenter={handleRomPointer}
      onpointermove={handleRomPointer}
      onpointerleave={handleRomLeave}
    >
      {#each blocks as block (block[0].rowKey ?? block[0].index)}
        {#if block.some((segment) => segment.romanization)}
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
        {/if}
      {/each}
    </div>
  {/if}
</div>
{#if textBoxEl}
  <ResizeHandle
    box={textBoxEl}
    minHeight={60}
    ariaLabel="Resize text section"
    onresizestart={() => (isResizing = true)}
    onresizeend={() => (isResizing = false)}
  />
{/if}
