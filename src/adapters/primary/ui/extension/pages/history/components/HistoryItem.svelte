<script lang="ts">
  import type { Translation } from '../../../../../../../core/domain/translation/Translation';
  import Icon from '../../../../shared/components/Icon.svelte';

  interface Props {
    translation: Translation;
    onopen: () => void;
    ondelete: () => void;
  }

  const { translation, onopen, ondelete }: Props = $props();

  const previewText = $derived(
    translation.original.map((s) => s.text).join(' '),
  );

  const formattedDate = $derived.by(() => {
    const d = translation.createdAt;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onopen();
    }
  }
</script>

<div
  role="button"
  tabindex="0"
  class="flex items-center w-full text-left gap-2 px-3 py-2.5 rounded-lg bg-surface border border-border hover:border-primary/40 transition-colors cursor-pointer group"
  onclick={onopen}
  onkeydown={handleKeydown}
>
  <span class="flex-1 text-sm text-foreground truncate">
    {previewText}
  </span>
  <span class="text-xs text-muted whitespace-nowrap">
    {formattedDate}
  </span>
  <button
    type="button"
    aria-label="Delete translation"
    class="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-red-400 cursor-pointer shrink-0"
    onclick={(e: MouseEvent) => {
      e.stopPropagation();
      ondelete();
    }}
  >
    <Icon name="trash" class="w-4 h-4" />
  </button>
</div>
