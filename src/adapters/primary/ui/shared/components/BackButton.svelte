<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();
</script>

<button
  type="button"
  class="flex items-center text-sm text-muted hover:text-foreground cursor-pointer"
  onclick={onback}
  aria-label="Back"
>
  <Icon name="arrow-left" class="w-4 h-4" />
</button>
