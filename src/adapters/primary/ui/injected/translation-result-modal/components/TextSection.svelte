<script lang="ts">
  import type { IndexedSegmentPayload } from '../TranslationModalController.svelte';
  import ResizeHandle from './ResizeHandle.svelte';

  interface Props {
    blocks: IndexedSegmentPayload[][];
    langColorMap: Map<string, number>;
    isMultiLang: boolean;
    hasRomanization: boolean;
    onSegmentHover?: (label: string | null) => void;
    crossHighlightIndex?: number | null;
    onSegmentIndexHover?: (index: number | null) => void;
  }

  const {
    blocks,
    langColorMap,
    isMultiLang,
    hasRomanization,
    onSegmentHover,
    crossHighlightIndex = null,
    onSegmentIndexHover,
  }: Props = $props();

  let textBoxEl = $state<HTMLDivElement>();

  let hoveredIndex = $state<number | null>(null);
  let isResizing = $state(false);

  const activeIndex = $derived(hoveredIndex ?? crossHighlightIndex);

  const flatSegments = $derived(blocks.flat());

  function handleTextContentPointer(e: PointerEvent) {
    if (isResizing) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-seg-index]',
    );
    if (!target) return;
    const i = Number(target.dataset.segIndex);
    hoveredIndex = i;
    onSegmentIndexHover?.(i);
    if (isMultiLang && flatSegments[i]) {
      const segment = flatSegments[i];
      const label = `${segment.language.name} (${segment.language.code})`;
      onSegmentHover?.(label);
    }
  }

  function handleTextContentLeave() {
    if (isResizing) return;
    hoveredIndex = null;
    onSegmentIndexHover?.(null);
    onSegmentHover?.(null);
  }

  function handleRomPointer(e: PointerEvent) {
    if (isResizing) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-seg-index]',
    );
    if (!target) return;
    const i = Number(target.dataset.segIndex);
    hoveredIndex = i;
    onSegmentIndexHover?.(i);
  }

  function handleRomLeave() {
    if (isResizing) return;
    hoveredIndex = null;
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
    {#each blocks as block}
      <span class="text-block">
        {#each block as segment}
          {#if isMultiLang}
            <span
              data-seg-index={segment.index}
              class="text-segment lang-gray-{langColorMap.get(
                segment.language.code,
              )}"
              class:seg-highlight={activeIndex === segment.index}
            >
              {segment.text}
            </span>{' '}
          {:else}
            <span
              data-seg-index={segment.index}
              class="text-segment"
              class:seg-highlight={activeIndex === segment.index}
            >
              {segment.text}
            </span>{' '}
          {/if}
        {/each}
      </span>
    {/each}
  </div>
  {#if hasRomanization}
    <div
      class="text-romanization"
      role="group"
      onpointerenter={handleRomPointer}
      onpointermove={handleRomPointer}
      onpointerleave={handleRomLeave}
    >
      {#each blocks as block}
        {#if block.some((segment) => segment.romanization)}
          <span class="text-block">
            {#each block as segment}
              {#if segment.romanization}
                <span
                  data-seg-index={segment.index}
                  class="rom-segment"
                  class:rom-highlight={activeIndex === segment.index}
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
