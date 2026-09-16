<script lang="ts">
  import ResizeHandle from './ResizeHandle.svelte';

  interface Props {
    text: string;
  }

  const { text }: Props = $props();

  let descBoxEl = $state<HTMLDivElement>();
</script>

<div class="description-box" bind:this={descBoxEl}>
  <p class="description-text">{text}</p>
</div>
{#if descBoxEl}
  <ResizeHandle
    box={descBoxEl}
    minHeight={40}
    ariaLabel="Resize description section"
  />
{/if}
