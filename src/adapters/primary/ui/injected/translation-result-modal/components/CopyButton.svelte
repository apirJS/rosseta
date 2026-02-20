<script lang="ts">
  type CopyState = 'idle' | 'copied';

  interface Props {
    state: CopyState;
    onclick: () => void;
    label?: string;
    small?: boolean;
  }

  const { state, onclick, label = 'Copy', small = false }: Props = $props();
</script>

<button
  class="icon-btn"
  class:icon-btn-sm={small}
  class:copy-feedback={state === 'copied'}
  {onclick}
  title={state === 'copied' ? 'Copied!' : label}
  aria-label={label}
>
  {#if state === 'copied'}
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  {:else}
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  {/if}
</button>
