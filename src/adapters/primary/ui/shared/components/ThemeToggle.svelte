<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    isDark: boolean;
    onToggle: () => void;
  }

  const { isDark, onToggle }: Props = $props();
</script>

<button
  type="button"
  onclick={onToggle}
  class="p-2 rounded-md text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
  aria-label="Toggle theme"
>
  {#if isDark}
    <Icon name="sun" class="w-5 h-5" />
  {:else}
    <Icon name="moon" class="w-5 h-5" />
  {/if}
</button>
