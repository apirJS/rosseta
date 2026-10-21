<script lang="ts">
  import { Select } from '../../../../shared/components';

  interface Props {
    value: string;
    options: Array<{ value: string; label: string }>;
    onchange?: (value: string) => void;
    disabled?: boolean;
  }

  const { value, options, onchange, disabled = false }: Props = $props();
  const isDisabled = $derived(disabled || options.length === 0);

  const displayedOptions = $derived(
    options.length > 0
      ? options
      : [{ value: '', label: '—', disabled: true, hidden: true }],
  );
</script>

<Select
  id="model-select"
  label="Model"
  value={isDisabled ? '' : value}
  options={displayedOptions}
  disabled={isDisabled}
  {onchange}
/>
