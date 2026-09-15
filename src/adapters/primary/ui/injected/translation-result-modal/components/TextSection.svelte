<script lang="ts">
  import type { SegmentPayload } from '../TranslationModalController.svelte';
  import ResizeHandle from './ResizeHandle.svelte';

  interface Props {
    segments: SegmentPayload[];
    langColorMap: Map<string, number>;
    isMultiLang: boolean;
    hasRomanization: boolean;
    onSegmentHover?: (label: string | null) => void;
    crossHighlightIndex?: number | null;
    onSegmentIndexHover?: (index: number | null) => void;
  }

  const {
    segments,
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

  function handleTextContentPointer(e: PointerEvent) {
    if (isResizing) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-seg-index]',
    );
    if (!target) return;
    const i = Number(target.dataset.segIndex);
    hoveredIndex = i;
    onSegmentIndexHover?.(i);
    if (isMultiLang && segments[i]) {
      const segment = segments[i];
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
    {#each segments as segment, i}
      {#if isMultiLang}
        <span
          data-seg-index={i}
          class="text-segment lang-gray-{langColorMap.get(
            segment.language.code,
          )}"
          class:seg-highlight={activeIndex === i}
        >
          {segment.text}
        </span>{' '}
      {:else}
        <span
          data-seg-index={i}
          class="text-segment"
          class:seg-highlight={activeIndex === i}
        >
          {segment.text}
        </span>{' '}
      {/if}
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
      {#each segments as segment, i}
        {#if segment.romanization}
          <span
            data-seg-index={i}
            class="rom-segment"
            class:rom-highlight={activeIndex === i}
          >
            {segment.romanization}
          </span>{' '}
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
