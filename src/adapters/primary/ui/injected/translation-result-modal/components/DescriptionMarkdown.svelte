<script lang="ts">
  import SvelteMarkdown, {
    buildUnsupportedHTML,
  } from '@humanspeak/svelte-markdown';
  import { sanitizeDescriptionUrl } from './description-markdown';

  interface Props {
    text: string;
  }

  const { text }: Props = $props();
  const options = { headerIds: false, gfm: true };
  const renderers = { html: buildUnsupportedHTML() };
</script>

<div class="description-text">
  <SvelteMarkdown
    source={text}
    streaming
    {options}
    {renderers}
    sanitizeUrl={sanitizeDescriptionUrl}
  >
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
