<script lang="ts">
  import type { Snippet } from 'svelte';
  import CopyButton from './CopyButton.svelte';

  type CopyState = 'idle' | 'copied';

  interface Props {
    label: string;
    copyState: CopyState;
    oncopy: () => void;
    labelTag?: string;
    copyLabel?: string;
    children: Snippet;
  }

  const {
    label,
    copyState,
    oncopy,
    labelTag,
    copyLabel = 'Copy',
    children,
  }: Props = $props();
</script>

<div class="section">
  <div class="section-header">
    <span class="section-label">
      {label}
      {#if labelTag !== undefined}
        <span class="section-label-tag">— {labelTag}</span>
      {/if}
    </span>
    <CopyButton small state={copyState} onclick={oncopy} label={copyLabel} />
  </div>
  {@render children()}
</div>
