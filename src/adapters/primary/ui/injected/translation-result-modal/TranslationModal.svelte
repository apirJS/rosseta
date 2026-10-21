<script lang="ts">
  import type { TranslationModalController } from './TranslationModalController.svelte';
  import ModalHeader from './components/ModalHeader.svelte';
  import ModalSection from './components/ModalSection.svelte';
  import TextSection from './components/TextSection.svelte';
  import DescriptionSection from './components/DescriptionSection.svelte';
  import TranslationFailure from './components/TranslationFailure.svelte';

  interface Props {
    controller: TranslationModalController;
  }

  const { controller: ctrl }: Props = $props();

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
    style:transform="translate({ctrl.drag.x}px, {ctrl.drag.y}px)"
  >
    <ModalHeader
      title={ctrl.phase === 'failed' ? 'Translation failed' : 'Translation'}
      status={ctrl.headerStatus}
      busy={ctrl.isBusy}
      onclose={ctrl.close}
      ondragstart={ctrl.drag.start}
    />

    <div class="modal-body">
      {#if ctrl.isUnsuccessful}
        <TranslationFailure
          title={ctrl.status}
          description={ctrl.failureDescription}
          onretry={ctrl.retry}
        />
      {:else}
        {#if ctrl.phase === 'completed' && !ctrl.historySaved}
          <p class="translation-error">Could not save to history.</p>
        {/if}
        <ModalSection
          label="Original"
          labelTag={ctrl.displayedLangLabel}
          copyState={ctrl.clipboard.states.original}
          oncopy={() => ctrl.copy('original')}
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
          copyState={ctrl.clipboard.states.translated}
          oncopy={() => ctrl.copy('translated')}
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
            copyState={ctrl.clipboard.states.description}
            oncopy={() => ctrl.copy('description')}
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
        onpointerdown={ctrl.drag.start}
      ></button>
    {/if}
  </div>
</div>
