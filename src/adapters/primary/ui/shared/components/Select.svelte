<script lang="ts">
  import { cn } from '../utils';
  import Icon from './Icon.svelte';

  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    id?: string;
    label?: string;
    value: string;
    options: Option[];
    onchange?: (value: string) => void;
    disabled?: boolean;
    class?: string;
  }

  const {
    id,
    label,
    value,
    options,
    onchange,
    disabled = false,
    class: className,
  }: Props = $props();

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    onchange?.(target.value);
  }

  const selectClass = $derived(
    cn(
      'w-full px-3 py-2 pr-8 border border-border rounded-md bg-background text-foreground',
      'appearance-none cursor-pointer',
      'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      className,
    ),
  );
</script>

{#snippet selectField()}
  <div class="relative">
    <select {id} {value} {disabled} class={selectClass} onchange={handleChange}>
      {#each options as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
    <div
      class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
    >
      <Icon name="chevron-down" class="w-4 h-4 text-foreground" />
    </div>
  </div>
{/snippet}

{#if label}
  <div>
    <label for={id} class="block text-sm font-medium text-foreground mb-1">
      {label}
    </label>
    {@render selectField()}
  </div>
{:else}
  {@render selectField()}
{/if}
