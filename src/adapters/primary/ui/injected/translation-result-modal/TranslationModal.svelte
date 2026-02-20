<script lang="ts">
  import {
    TranslationModalController,
    type SegmentPayload,
  } from './TranslationModalController.svelte';
  import ModalHeader from './components/ModalHeader.svelte';
  import TextSection from './components/TextSection.svelte';
  import DescriptionSection from './components/DescriptionSection.svelte';
  import CopyButton from './components/CopyButton.svelte';

  interface Props {
    id: string;
    original: SegmentPayload[];
    translated: SegmentPayload[];
    description: string;
    createdAt: Date;
    detachModal: () => void;
  }

  const { original, translated, description, detachModal }: Props = $props();

  const ctrl = new TranslationModalController({
    original,
    translated,
    description,
    detachModal,
  });

  // --- Hovered language label (overrides "Mixed" when hovering a segment) ---
  let hoveredLangLabel = $state<string | null>(null);

  // --- Cross-highlight: track which segment index is hovered in either section ---
  let hoveredSegmentIndex = $state<number | null>(null);
  // Which side is being hovered ('original' | 'translated' | null)
  let hoveredSide = $state<'original' | 'translated' | null>(null);

  const displayedLangLabel = $derived(
    hoveredLangLabel ?? ctrl.detectedLanguageLabel,
  );

  function handleSegmentHover(label: string | null) {
    hoveredLangLabel = label;
  }

  function handleOriginalIndexHover(index: number | null) {
    hoveredSegmentIndex = index;
    hoveredSide = index != null ? 'original' : null;
  }

  function handleTranslatedIndexHover(index: number | null) {
    hoveredSegmentIndex = index;
    hoveredSide = index != null ? 'translated' : null;
  }
  // Auto-focus this modal's backdrop so it receives keyboard events
  let backdropEl: HTMLDivElement;
  $effect(() => {
    backdropEl?.focus();
  });
</script>

<div
  class="modal-backdrop"
  role="presentation"
  bind:this={backdropEl}
  tabindex="-1"
  onkeydown={ctrl.handleKeydown}
  onpointerdown={() => backdropEl?.focus()}
>
  <div
    class="modal-container"
    role="dialog"
    aria-label="Translation Result"
    style:transform="translate({ctrl.posX}px, {ctrl.posY}px)"
  >
    <ModalHeader
      title="Translation"
      onclose={ctrl.close}
      ondragstart={ctrl.handleDragStart}
    />

    <div class="modal-body">
      <!-- Original -->
      <div class="section">
        <div class="section-header">
          <span class="section-label"
            >Original <span class="section-label-tag"
              >— {displayedLangLabel}</span
            ></span
          >
          <CopyButton
            small
            state={ctrl.originalCopy}
            onclick={ctrl.copyOriginal}
          />
        </div>
        <TextSection
          segments={ctrl.original}
          langColorMap={ctrl.langColorMap}
          isMultiLang={ctrl.isMultiLang}
          hasRomanization={ctrl.originalHasRomanization}
          onSegmentHover={handleSegmentHover}
          crossHighlightIndex={hoveredSide === 'translated'
            ? hoveredSegmentIndex
            : null}
          onSegmentIndexHover={handleOriginalIndexHover}
        />
      </div>

      <!-- Translated -->
      <div class="section">
        <div class="section-header">
          <span class="section-label"
            >Translated <span class="section-label-tag"
              >— {ctrl.targetLanguageLabel}</span
            ></span
          >
          <CopyButton
            small
            state={ctrl.translatedCopy}
            onclick={ctrl.copyTranslated}
          />
        </div>
        <TextSection
          segments={ctrl.translated}
          langColorMap={ctrl.langColorMap}
          isMultiLang={false}
          hasRomanization={ctrl.translatedHasRomanization}
          crossHighlightIndex={hoveredSide === 'original'
            ? hoveredSegmentIndex
            : null}
          onSegmentIndexHover={handleTranslatedIndexHover}
        />
      </div>

      <!-- Description -->
      {#if ctrl.description}
        <div class="section">
          <div class="section-header">
            <span class="section-label">Description</span>
            <CopyButton
              small
              state={ctrl.descriptionCopy}
              onclick={ctrl.copyDescription}
              label="Copy description"
            />
          </div>
          <DescriptionSection text={ctrl.description} />
        </div>
      {/if}
    </div>

    <button
      type="button"
      class="modal-footer-drag"
      aria-label="Move modal"
      onpointerdown={ctrl.handleDragStart}
    ></button>
  </div>
</div>
