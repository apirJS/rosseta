<script lang="ts">
  import type { Snippet } from 'svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    children: Snippet;
    showBack?: boolean;
    onback?: () => void;
    isDark?: boolean;
    onToggleTheme?: () => void;
  }

  const {
    children,
    showBack = false,
    onback,
    isDark = false,
    onToggleTheme,
  }: Props = $props();
</script>

<div class="flex flex-col h-full w-full bg-background">
  <div class="flex justify-between items-center p-4 pb-0">
    {#if showBack && onback}
      <button
        type="button"
        class="flex items-center text-sm text-muted hover:text-foreground cursor-pointer"
        onclick={onback}
      >
        <Icon name="arrow-left" class="w-4 h-4 mr-1" />
        Back
      </button>
    {:else}
      <div></div>
    {/if}
    {#if onToggleTheme}
      <ThemeToggle {isDark} onToggle={onToggleTheme} />
    {/if}
  </div>

  <div
    class="flex-1 flex flex-col justify-center px-4 pb-4 min-h-0 overflow-hidden"
  >
    {@render children()}
  </div>
</div>
