<script lang="ts">
  import { cn } from '../utils';
  import Icon from './Icon.svelte';

  interface Props {
    value: string;
    onadd: () => void;
    placeholder: string;
    addLabel: string;
    canAdd: boolean;
    type?: 'text' | 'password';
    disabled?: boolean;
    class?: string;
  }

  let {
    value = $bindable(''),
    onadd,
    placeholder,
    addLabel,
    canAdd,
    type = 'text',
    disabled = false,
    class: className,
  }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') onadd();
  }
</script>

<div class={cn('flex gap-2', className)}>
  <input
    {type}
    class="flex-1 min-w-0 px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-primary"
    {placeholder}
    bind:value
    onkeydown={handleKeydown}
  />
  <button
    type="button"
    class="flex items-center justify-center w-10 shrink-0 rounded-lg bg-primary text-primary-fg hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    onclick={() => onadd()}
    disabled={!canAdd || disabled}
    aria-label={addLabel}
    title={addLabel}
  >
    <Icon name="plus" class="w-4 h-4" />
  </button>
</div>
