<script lang="ts">
  import type { TranslationModalController } from './TranslationModalController.svelte';
  import ModalHeader from './components/ModalHeader.svelte';
  import ModalSection from './components/ModalSection.svelte';
  import TextSection from './components/TextSection.svelte';
  import DescriptionSection from './components/DescriptionSection.svelte';

  interface Props {
    controller: TranslationModalController;
  }

  const { controller: ctrl }: Props = $props();

  let backdropEl: HTMLDivElement;
  let retryEl = $state<HTMLButtonElement>();
  $effect(() => {
    backdropEl?.focus();
  });
  $effect(() => {
    if (ctrl.isUnsuccessful) retryEl?.focus({ preventScroll: true });
  });
</script>

<div
  class="modal-backdrop"
  role="presentation"
  bind:this={backdropEl}
  tabindex="-1"
  onpointerdown={() => backdropEl?.focus()}
  onkeydown={(event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      ctrl.close();
    }
  }}
>
  <div
    class="modal-container"
    class:modal-container-compact={ctrl.isUnsuccessful}
    role="dialog"
    aria-label={ctrl.isUnsuccessful ? ctrl.status : 'Translation Result'}
    aria-busy={ctrl.isBusy}
    tabindex="-1"
    style:transform="translate({ctrl.posX}px, {ctrl.posY}px)"
  >
    <ModalHeader
      title={ctrl.phase === 'failed' ? 'Translation failed' : 'Translation'}
      status={ctrl.isUnsuccessful ? '' : ctrl.status}
      busy={ctrl.isBusy}
      onclose={ctrl.close}
      ondragstart={ctrl.handleDragStart}
    />

    <div class="modal-body">
      {#if ctrl.isUnsuccessful}
        <h2 class="translation-error-title">{ctrl.status}</h2>
        <p class="translation-error" role="alert">{ctrl.failureDescription}</p>
        <button
          class="translation-retry"
          type="button"
          onclick={ctrl.retry}
          bind:this={retryEl}
        >
          Select area again
        </button>
      {:else}
        {#if ctrl.phase === 'completed' && !ctrl.historySaved}
          <p class="translation-error">Could not save to history.</p>
        {/if}
        <ModalSection
          label="Original"
          labelTag={ctrl.displayedLangLabel}
          copyState={ctrl.originalCopy}
          oncopy={ctrl.copyOriginal}
          copyLabel="Copy original text"
          disabled={!ctrl.canCopy}
        >
          <TextSection
            blocks={ctrl.originalBlocks}
            langColorMap={ctrl.langColorMap}
            isMultiLang={ctrl.isMultiLang}
            hasRomanization={ctrl.originalHasRomanization}
            highlightIndex={ctrl.highlightedSegmentIndex}
            onSegmentIndexHover={ctrl.hoverOriginalSegment}
            pending={ctrl.isBusy}
          />
        </ModalSection>

        <ModalSection
          label="Translated"
          labelTag={ctrl.targetLanguageLabel}
          copyState={ctrl.translatedCopy}
          oncopy={ctrl.copyTranslated}
          copyLabel="Copy translated text"
          disabled={!ctrl.canCopy}
        >
          <TextSection
            blocks={ctrl.translatedBlocks}
            langColorMap={ctrl.langColorMap}
            isMultiLang={false}
            hasRomanization={ctrl.translatedHasRomanization}
            highlightIndex={ctrl.highlightedSegmentIndex}
            onSegmentIndexHover={ctrl.hoverTranslatedSegment}
            pending={ctrl.isBusy}
          />
        </ModalSection>

        {#if ctrl.description}
          <ModalSection
            label="Description"
            copyState={ctrl.descriptionCopy}
            oncopy={ctrl.copyDescription}
            copyLabel="Copy description"
            disabled={!ctrl.canCopy}
          >
            <DescriptionSection text={ctrl.description} />
          </ModalSection>
        {/if}
      {/if}
    </div>

    {#if !ctrl.isUnsuccessful}
      <button
        type="button"
        class="modal-footer-drag"
        aria-label="Move modal"
        onpointerdown={ctrl.handleDragStart}
      ></button>
    {/if}
  </div>
</div>
