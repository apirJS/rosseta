<script lang="ts">
  import type { TranslationModalController } from './TranslationModalController.svelte';
  import { ModalViewportController } from './ModalViewportController.svelte';
  import ModalHeader from './components/ModalHeader.svelte';
  import TranslationResult from './TranslationResult.svelte';

  interface Props {
    controller: TranslationModalController;
  }

  const { controller }: Props = $props();
  const viewport = new ModalViewportController(() => controller);
  const layout = viewport.layout;

  $effect(viewport.focusBackdrop);
  $effect(() => viewport.observeContent());
  $effect(() => viewport.constrainPosition());
</script>

<svelte:window
  bind:innerWidth={viewport.width}
  bind:innerHeight={viewport.height}
/>

<div
  class="modal-backdrop"
  role="presentation"
  bind:this={viewport.backdrop}
  tabindex="-1"
  onpointerdown={viewport.focusBackdrop}
  onkeydown={viewport.handleKeydown}
>
  <div
    class="modal-container"
    class:modal-container-compact={controller.isUnsuccessful}
    class:modal-container-columns={layout.columns > 1 &&
      !controller.isUnsuccessful}
    class:modal-container-description-side={layout.mode ===
      'description-side' && !controller.isUnsuccessful}
    bind:this={viewport.modal}
    role="dialog"
    aria-label={controller.isUnsuccessful
      ? controller.status
      : 'Translation Result'}
    aria-busy={controller.isBusy}
    tabindex="-1"
    style:transform="translate({controller.drag.x}px, {controller.drag.y}px)"
    style:--modal-preferred-width={layout.width}
    style:min-width={layout.minWidth}
    style:--translation-columns={layout.columns}
  >
    <ModalHeader
      title={controller.title}
      status={controller.headerStatus}
      busy={controller.isBusy}
      onclose={controller.close}
      ondragstart={controller.drag.start}
    />
    <TranslationResult {controller} {viewport} />
    {#if !controller.isUnsuccessful}
      <button
        type="button"
        class="modal-footer-drag"
        aria-label="Move modal"
        onpointerdown={controller.drag.start}
      ></button>
    {/if}
  </div>
</div>
