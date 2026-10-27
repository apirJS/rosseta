<script lang="ts">
  import { formatTranslationStatus } from './translation-status';

  interface Props {
    status: string;
    busy: boolean;
  }

  const { status, busy }: Props = $props();
</script>

{#if status}
  <span
    class="translation-status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <span>{formatTranslationStatus(status, busy)}</span>
    {#if busy}
      <span class="translation-status-dots" aria-hidden="true"
        ><span>...</span></span
      >
    {/if}
  </span>
{/if}
