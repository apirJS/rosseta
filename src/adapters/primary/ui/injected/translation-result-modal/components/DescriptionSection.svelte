<script lang="ts">
  import SvelteMarkdown, {
    buildUnsupportedHTML,
  } from '@humanspeak/svelte-markdown';
  import ResizeHandle from './ResizeHandle.svelte';

  interface Props {
    text: string;
  }

  const { text }: Props = $props();
  const options = { headerIds: false, gfm: true };
  const renderers = { html: buildUnsupportedHTML() };

  let descBoxEl = $state<HTMLDivElement>();

  function sanitizeUrl(value: string): string {
    try {
      const url = new URL(value);

      return url.protocol === 'https:' || url.protocol === 'http:'
        ? url.href
        : '';
    } catch {
      return '';
    }
  }
</script>

<div class="description-box" bind:this={descBoxEl}>
  <div class="description-text">
    <SvelteMarkdown source={text} streaming {options} {renderers} {sanitizeUrl}>
      {#snippet link({ href, title, children })}
        {#if href}
          <a {href} {title} target="_blank" rel="noopener noreferrer">
            {@render children?.()}
          </a>
        {:else}
          <span>{@render children?.()}</span>
        {/if}
      {/snippet}

      {#snippet image({ text })}
        <span>{text}</span>
      {/snippet}
    </SvelteMarkdown>
  </div>
</div>
{#if descBoxEl}
  <ResizeHandle
    box={descBoxEl}
    minHeight={40}
    ariaLabel="Resize description section"
  />
{/if}
