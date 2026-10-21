<script lang="ts">
  import Select from './Select.svelte';

  interface Props {
    value: string;
    options: Array<{ value: string; label: string }>;
    compact?: boolean;
    disabled?: boolean;
    onchange?: (value: string) => void;
  }

  const {
    value,
    options,
    compact = false,
    disabled = false,
    onchange,
  }: Props = $props();
</script>

<Select
  id="provider-select"
  label={compact ? undefined : 'Provider'}
  {value}
  {options}
  {disabled}
  onchange={(newValue) => onchange?.(newValue)}
/>
