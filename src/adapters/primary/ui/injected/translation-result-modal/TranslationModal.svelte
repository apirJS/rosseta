<script lang="ts">
  import {
    TranslationModalController,
    type SegmentPayload,
  } from './TranslationModalController.svelte';
  import ModalHeader from './components/ModalHeader.svelte';
  import ModalSection from './components/ModalSection.svelte';
  import TextSection from './components/TextSection.svelte';
  import DescriptionSection from './components/DescriptionSection.svelte';

  interface Props {
    id: string;
    original: SegmentPayload[];
    translated: SegmentPayload[];
    description: string;
    createdAt: Date;
    detachModal: () => void;
  }

  const { original, translated, description, detachModal }: Props = $props();

  // svelte-ignore state_referenced_locally
  const ctrl = new TranslationModalController({
    original,
    translated,
    description,
    detachModal,
  });

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
      <ModalSection
        label="Original"
        labelTag={ctrl.displayedLangLabel}
        copyState={ctrl.originalCopy}
        oncopy={ctrl.copyOriginal}
      >
        <TextSection
          segments={ctrl.original}
          langColorMap={ctrl.langColorMap}
          isMultiLang={ctrl.isMultiLang}
          hasRomanization={ctrl.originalHasRomanization}
          onSegmentHover={ctrl.setHoveredLanguageLabel}
          crossHighlightIndex={ctrl.originalCrossHighlight}
          onSegmentIndexHover={ctrl.hoverOriginalSegment}
        />
      </ModalSection>

      <ModalSection
        label="Translated"
        labelTag={ctrl.targetLanguageLabel}
        copyState={ctrl.translatedCopy}
        oncopy={ctrl.copyTranslated}
      >
        <TextSection
          segments={ctrl.translated}
          langColorMap={ctrl.langColorMap}
          isMultiLang={false}
          hasRomanization={ctrl.translatedHasRomanization}
          crossHighlightIndex={ctrl.translatedCrossHighlight}
          onSegmentIndexHover={ctrl.hoverTranslatedSegment}
        />
      </ModalSection>

      {#if ctrl.description}
        <ModalSection
          label="Description"
          copyState={ctrl.descriptionCopy}
          oncopy={ctrl.copyDescription}
          copyLabel="Copy description"
        >
          <DescriptionSection text={ctrl.description} />
        </ModalSection>
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
