<script lang="ts">
  import { cn } from '../utils';

  interface Props {
    href: string;
    external?: boolean;
    class?: string;
    children: import('svelte').Snippet;
  }

  const { href, external = false, class: className, children }: Props = $props();
</script>

<a
  {href}
  target={external ? '_blank' : undefined}
  rel={external ? 'noopener noreferrer' : undefined}
  class={cn('text-primary hover:underline', className)}
>
  {@render children()}
</a>
