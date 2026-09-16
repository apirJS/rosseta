<script lang="ts">
  import type { Snippet } from 'svelte';
  import BackButton from './BackButton.svelte';
  import ThemeToggle from './ThemeToggle.svelte';

  interface Props {
    children: Snippet;
    onback?: () => void;
    start?: Snippet;
    title?: string;
    footer?: Snippet;
    isDark?: boolean;
    onToggleTheme?: () => void;
  }

  const {
    children,
    onback,
    start,
    title,
    footer,
    isDark = false,
    onToggleTheme,
  }: Props = $props();
</script>

<div class="flex flex-col h-full w-full bg-background">
  <header class="flex items-center p-4 pb-0 gap-2">
    {#if onback}
      <BackButton {onback} />
    {/if}
    {#if start}
      {@render start()}
    {/if}
    {#if title}
      <h2 class="flex-1 text-center text-base font-semibold text-foreground truncate">
        {title}
      </h2>
    {:else}
      <div class="flex-1"></div>
    {/if}
    {#if onToggleTheme}
      <ThemeToggle {isDark} onToggle={onToggleTheme} />
    {/if}
  </header>

  <div class="flex-1 flex flex-col px-4 py-3 min-h-0 overflow-hidden">
    {@render children()}
  </div>

  {#if footer}
    {@render footer()}
  {/if}
</div>
