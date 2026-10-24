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
    disabled?: boolean;
    children: Snippet;
  }

  const {
    label,
    copyState,
    oncopy,
    labelTag,
    copyLabel = 'Copy',
    disabled = false,
    children,
  }: Props = $props();
</script>

<div class="section">
  <div class="section-header">
    <span class="section-label" title={labelTag}>
      {label}
      {#if labelTag !== undefined}
        <span class="section-label-tag">— {labelTag}</span>
      {/if}
    </span>
    <CopyButton
      small
      state={copyState}
      onclick={oncopy}
      label={copyLabel}
      {disabled}
    />
  </div>
  {@render children()}
</div>
