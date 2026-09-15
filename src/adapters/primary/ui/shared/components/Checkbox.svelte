<script lang="ts">
  import { cn } from '../utils';

  type HTMLInputEvent = Event & {
    currentTarget: EventTarget & HTMLInputElement;
  };

  interface Props {
    label: string;
    checked: boolean;
    onChange: (e: HTMLInputEvent) => Promise<void>;
    class?: string;
  }

  const { label, checked, onChange, class: className = '' }: Props = $props();

  const labelClass = $derived(
    cn(
      'flex items-center justify-between text-sm font-medium text-foreground cursor-pointer select-none',
      className,
    ),
  );
</script>

<label class={labelClass}>
  {label}
  <input type="checkbox" class="peer sr-only" {checked} onchange={onChange} />
  <span
    class="relative h-4 w-4 shrink-0 rounded-sm border border-border bg-transparent transition-colors
      peer-checked:border-primary peer-checked:bg-primary
      peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background
      after:absolute after:content-[''] after:left-1.25 after:top-0.5 after:h-2.25 after:w-1.25
      after:rotate-45 after:border-b-2 after:border-r-2 after:border-primary-fg
      after:opacity-0 after:transition-opacity
      peer-checked:after:opacity-100"
    aria-hidden="true"
  ></span>
</label>
