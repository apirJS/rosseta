<script lang="ts">
  import { Icon } from '../../../../shared/components';

  interface Props {
    isFetching: boolean;
    onfetch: () => void;
    onreset: () => void;
  }

  const { isFetching, onfetch, onreset }: Props = $props();
</script>

<div class="flex items-center gap-2 px-4 py-3 border-t border-border">
  <button
    type="button"
    class="px-3 py-1.5 rounded-lg bg-primary text-primary-fg text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
    onclick={onfetch}
    disabled={isFetching}
  >
    {#if isFetching}
      <Icon name="spinner" class="w-4 h-4" />
    {/if}
    {isFetching ? 'Fetching…' : 'Fetch Models'}
  </button>
  <button
    type="button"
    class="px-3 py-1.5 rounded-lg bg-surface border border-border text-sm text-muted hover:text-foreground cursor-pointer ml-auto"
    onclick={onreset}
  >
    Reset
  </button>
</div>
