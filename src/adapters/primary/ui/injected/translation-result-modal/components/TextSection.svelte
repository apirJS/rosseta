<script lang="ts">
  import type { SegmentPayload } from '../TranslationModalController.svelte';

  interface Props {
    segments: SegmentPayload[];
    langColorMap: Map<string, number>;
    isMultiLang: boolean;
    hasRomanization: boolean;
    onSegmentHover?: (label: string | null) => void;
    /** Index hovered in the sibling section (cross-highlight) */
    crossHighlightIndex?: number | null;
    /** Notify parent which segment index is hovered here */
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

  let textBoxEl: HTMLDivElement;

  // Track which segment index is currently hovered (text or romanization)
  let hoveredIndex = $state<number | null>(null);

  // Merge internal hover and cross-highlight from sibling section
  const activeIndex = $derived(hoveredIndex ?? crossHighlightIndex);
  let isResizing = $state(false);

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

  // --- Resize ---

  /**
   * Freeze all sibling `.section` elements to their current computed heights.
   * This prevents flex-competition from absorbing the space change when one
   * section is being resized (which made the ORIGINAL resize look broken).
   */
  function freezeSiblingSections(currentSection: HTMLElement): () => void {
    const parent = currentSection.parentElement;
    if (!parent) return () => {};

    const siblings = Array.from(
      parent.querySelectorAll(':scope > .section'),
    ).filter((el): el is HTMLElement => el !== currentSection);

    const saved = siblings.map((el) => ({
      el,
      flex: el.style.flex,
      height: el.style.height,
      minHeight: el.style.minHeight,
    }));

    for (const sib of siblings) {
      const h = sib.getBoundingClientRect().height;
      sib.style.height = `${h}px`;
      sib.style.flex = 'none';
      sib.style.minHeight = '0';
    }

    return () => {
      for (const { el, flex, height, minHeight } of saved) {
        el.style.flex = flex;
        el.style.height = height;
        el.style.minHeight = minHeight;
      }
    };
  }

  function handleResizePointerDown(e: PointerEvent) {
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    isResizing = true;

    const startY = e.clientY;
    const startHeight = textBoxEl.getBoundingClientRect().height;
    const section = textBoxEl.closest('.section') as HTMLElement | null;

    // Freeze siblings so they don't absorb freed space
    const unfreezesiblings = section
      ? freezeSiblingSections(section)
      : () => {};

    const onMove = (e: PointerEvent) => {
      const delta = e.clientY - startY;
      const newHeight = Math.max(60, startHeight + delta);
      textBoxEl.style.height = `${newHeight}px`;
      textBoxEl.style.flex = 'none';
      if (section) {
        section.style.flex = 'none';
        section.style.minHeight = '0';
      }
    };

    const onUp = (e: PointerEvent) => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      isResizing = false;
      unfreezesiblings();
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
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
<button
  type="button"
  class="resize-handle"
  aria-label="Resize text section"
  onpointerdown={handleResizePointerDown}
></button>
