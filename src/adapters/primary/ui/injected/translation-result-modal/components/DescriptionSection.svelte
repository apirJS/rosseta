<script lang="ts">
  import DescriptionMarkdown from './DescriptionMarkdown.svelte';
  import ResizeHandle from './ResizeHandle.svelte';

  interface Props {
    text: string;
  }

  const { text }: Props = $props();
  let descBoxEl = $state<HTMLDivElement>();
</script>

<div class="description-box" bind:this={descBoxEl}>
  <DescriptionMarkdown {text} />
</div>
{#if descBoxEl}
  <ResizeHandle
    box={descBoxEl}
    minHeight={40}
    ariaLabel="Resize description section"
  />
{/if}
