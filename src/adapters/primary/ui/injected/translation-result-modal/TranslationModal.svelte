<script lang="ts">
  import { untrack } from 'svelte';
  import type { TranslationModalController } from './TranslationModalController.svelte';
  import { ModalLayoutController } from './ModalLayoutController.svelte';
  import { measureDescriptionLayout } from './modal-layout-measurement';
  import ModalHeader from './components/ModalHeader.svelte';
  import ModalSection from './components/ModalSection.svelte';
  import TextSection from './components/TextSection.svelte';
  import DescriptionSection from './components/DescriptionSection.svelte';
  import TranslationFailure from './components/TranslationFailure.svelte';

  interface Props {
    controller: TranslationModalController;
  }

  const { controller: ctrl }: Props = $props();
  const layout = new ModalLayoutController();

  let backdropEl: HTMLDivElement;
  let modalEl = $state<HTMLDivElement>();
  let bodyEl = $state<HTMLDivElement>();
  let sectionsEl = $state<HTMLDivElement>();
  let textColumnEl = $state<HTMLDivElement>();
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);

  $effect(() => {
    backdropEl?.focus();
  });

  $effect(() => {
    const body = bodyEl;
    const modal = modalEl;
    const sections = sectionsEl;
    const textColumn = textColumnEl;
    const renderedMode = layout.mode;
    const unsuccessful = ctrl.isUnsuccessful;
    const viewport = { width: viewportWidth, height: viewportHeight };

    const content = {
      revision: ctrl.attemptRevision,
      hasContent:
        ctrl.original.length > 0 ||
        ctrl.translated.length > 0 ||
        !!ctrl.description,
      hasDescription: !!ctrl.description,
      unsuccessful,
    };

    untrack(() => layout.setContent(content));
    if (!modal || !body || !sections || !textColumn || unsuccessful) return;

    let frame: number | undefined;
    let active = true;

    const scheduleMeasure = () => {
      if (!active || frame !== undefined) return;

      frame = requestAnimationFrame(() => {
        frame = undefined;

        const descriptionLayout =
          renderedMode === 'three-columns'
            ? measureDescriptionLayout({
                modal,
                sections,
                textColumn,
                viewportWidth: viewport.width,
                viewportHeight: viewport.height,
                preferredModalWidth: layout.descriptionSideWidth,
                minimumModalWidth: layout.descriptionSideMinWidth,
              })
            : {
                textStackHeight: Infinity,
                availableHeight: sections.clientHeight,
              };

        layout.measure({
          renderedMode,
          overflowing: body.scrollHeight > body.clientHeight + 1,
          textColumnOverflowing:
            textColumn.scrollHeight > textColumn.clientHeight + 1,
          viewportWidth: viewport.width,
          ...descriptionLayout,
        });
      });
    };

    const observer = new ResizeObserver(scheduleMeasure);

    observer.observe(body);
    observer.observe(sections);
    observer.observe(textColumn);
    scheduleMeasure();

    return () => {
      active = false;
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  });

  $effect(() => {
    const mode = layout.mode;
    const modal = modalEl;
    const body = bodyEl;
    const viewport = { width: viewportWidth, height: viewportHeight };

    if (!modal || !body || mode === 'stacked') return;
    body.scrollTop = 0;

    const frame = requestAnimationFrame(() => {
      ctrl.drag.constrainToViewport(modal.getBoundingClientRect(), viewport);
    });

    return () => cancelAnimationFrame(frame);
  });
</script>

<svelte:window
  bind:innerWidth={viewportWidth}
  bind:innerHeight={viewportHeight}
/>

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
    class:modal-container-columns={layout.columns > 1 && !ctrl.isUnsuccessful}
    class:modal-container-description-side={layout.mode ===
      'description-side' && !ctrl.isUnsuccessful}
    bind:this={modalEl}
    role="dialog"
    aria-label={ctrl.isUnsuccessful ? ctrl.status : 'Translation Result'}
    aria-busy={ctrl.isBusy}
    tabindex="-1"
    style:transform="translate({ctrl.drag.x}px, {ctrl.drag.y}px)"
    style:--modal-preferred-width={layout.width}
    style:min-width={layout.minWidth}
    style:--translation-columns={layout.columns}
  >
    <ModalHeader
      title={ctrl.phase === 'failed' ? 'Translation failed' : 'Translation'}
      status={ctrl.headerStatus}
      busy={ctrl.isBusy}
      onclose={ctrl.close}
      ondragstart={ctrl.drag.start}
    />

    <div class="modal-body" bind:this={bodyEl}>
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
        <div class="translation-sections" bind:this={sectionsEl}>
          <div class="translation-text-sections" bind:this={textColumnEl}>
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
                onSegmentIndexHover={ctrl.hoverSegment}
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
                onSegmentIndexHover={ctrl.hoverSegment}
                pending={ctrl.isBusy}
              />
            </ModalSection>
          </div>
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
        </div>
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
