<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../utils';
  import Icon from './Icon.svelte';

  interface Props {
    variant?:
      | 'primary'
      | 'secondary'
      | 'outline'
      | 'ghost'
      | 'destructive'
      | 'link';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    disabled?: boolean;
    href?: string;
    class?: string;
    children: Snippet;
    [key: string]: unknown;
  }

  let {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    href = undefined,
    class: className = '',
    children,
    ...rest
  }: Props = $props();

  const baseStyles =
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variants = {
    primary: 'bg-primary text-primary-fg hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive:
      'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline:
      'border border-border bg-transparent text-foreground hover:bg-surface',
    ghost: 'hover:bg-surface hover:text-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  };

  const sizes = {
    sm: 'h-9 rounded-md px-3',
    md: 'h-10 px-4 py-2',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10',
  };

  const finalClass = $derived(
    cn(baseStyles, variants[variant], sizes[size], className),
  );
</script>

{#if href}
  <a {href} class={finalClass} {...rest}>
    {#if isLoading}
      <Icon name="spinner" class="-ml-1 mr-2 h-4 w-4" />
    {:else}
      {@render children?.()}
    {/if}
  </a>
{:else}
  <button class={finalClass} disabled={isLoading || disabled} {...rest}>
    {#if isLoading}
      <Icon name="spinner" class="-ml-1 mr-2 h-4 w-4" />
      <span class="opacity-70">Processing...</span>
    {:else}
      {@render children?.()}
    {/if}
  </button>
{/if}
