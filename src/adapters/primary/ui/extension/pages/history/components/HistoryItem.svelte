<script lang="ts">
  import Icon from '../../../../shared/components/Icon.svelte';

  interface Props {
    previewText: string;
    formattedDate: string;
    onopen: () => void;
    ondelete: () => void;
  }

  const { previewText, formattedDate, onopen, ondelete }: Props = $props();
</script>

<div
  class="flex items-center w-full gap-2 pr-3 rounded-lg bg-surface border border-border hover:border-primary/40 transition-colors group"
>
  <button
    type="button"
    class="flex flex-1 min-w-0 items-center text-left gap-2 pl-3 py-2.5 cursor-pointer"
    onclick={onopen}
  >
    <span class="flex-1 text-sm text-foreground truncate">{previewText}</span>
    <span class="text-xs text-muted whitespace-nowrap">{formattedDate}</span>
  </button>
  <button
    type="button"
    aria-label="Delete translation"
    class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-muted hover:text-red-400 cursor-pointer shrink-0"
    onclick={ondelete}
  >
    <Icon name="trash" class="w-4 h-4" />
  </button>
</div>
