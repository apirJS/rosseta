<script lang="ts">
  import { cn } from '../utils';

  interface Props {
    id?: string;
    type?: 'text' | 'password' | 'email';
    value?: string;
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    class?: string;
    oninput?: (value: string) => void;
    [key: string]: unknown;
  }

  let {
    id,
    type = 'text',
    value = '',
    placeholder = '',
    label,
    disabled = false,
    class: className = '',
    oninput,
    ...rest
  }: Props = $props();

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    oninput?.(target.value);
  }

  const inputClass = $derived(
    cn(
      'w-full px-3 py-2 border border-border rounded-md bg-background text-foreground',
      'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      className,
    ),
  );
</script>

{#if label}
  <div>
    <label for={id} class="block text-sm font-medium text-foreground mb-1">
      {label}
    </label>
    <input
      {id}
      {type}
      {value}
      {placeholder}
      {disabled}
      class={inputClass}
      oninput={handleInput}
      {...rest}
    />
  </div>
{:else}
  <input
    {id}
    {type}
    {value}
    {placeholder}
    {disabled}
    class={inputClass}
    oninput={handleInput}
    {...rest}
  />
{/if}
