<script lang="ts">
  import type { TranslationModalController } from './TranslationModalController.svelte';
  import type { ModalViewportController } from './ModalViewportController.svelte';
  import TranslationTextPanel from './TranslationTextPanel.svelte';
  import ModalSection from './components/ModalSection.svelte';
  import DescriptionSection from './components/DescriptionSection.svelte';
  import TranslationFailure from './components/TranslationFailure.svelte';

  interface Props {
    controller: TranslationModalController;
    viewport: ModalViewportController;
  }

  const { controller, viewport }: Props = $props();
</script>

<div class="modal-body" bind:this={viewport.body}>
  {#if controller.isUnsuccessful}
    <TranslationFailure
      title={controller.status}
      description={controller.failureDescription}
      onretry={controller.retry}
    />
  {:else}
    {#if controller.showHistoryWarning}
      <p class="translation-error">Could not save to history.</p>
    {/if}
    <div class="translation-sections" bind:this={viewport.sections}>
      <div class="translation-text-sections" bind:this={viewport.textColumn}>
        <TranslationTextPanel
          label="Original"
          copyLabel="Copy original text"
          languageLabel={controller.segments.displayedLangLabel}
          blocks={controller.segments.originalBlocks}
          copyState={controller.clipboard.states.original}
          oncopy={controller.copyOriginal}
          canCopy={controller.canCopy}
          langColorMap={controller.segments.langColorMap}
          isMultiLang={controller.segments.isMultiLang}
          hasRomanization={controller.segments.originalHasRomanization}
          highlightIndex={controller.segments.highlightedSegmentIndex}
          onhover={controller.segments.hoverSegment}
          pending={controller.isBusy}
        />
        <TranslationTextPanel
          label="Translated"
          copyLabel="Copy translated text"
          languageLabel={controller.segments.targetLanguageLabel}
          blocks={controller.segments.translatedBlocks}
          copyState={controller.clipboard.states.translated}
          oncopy={controller.copyTranslated}
          canCopy={controller.canCopy}
          langColorMap={controller.segments.langColorMap}
          hasRomanization={controller.segments.translatedHasRomanization}
          highlightIndex={controller.segments.highlightedSegmentIndex}
          onhover={controller.segments.hoverSegment}
          pending={controller.isBusy}
        />
      </div>
      {#if controller.description}
        <ModalSection
          label="Description"
          copyState={controller.clipboard.states.description}
          oncopy={controller.copyDescription}
          copyLabel="Copy description"
          disabled={!controller.canCopy}
        >
          <DescriptionSection text={controller.description} />
        </ModalSection>
      {/if}
    </div>
  {/if}
</div>
