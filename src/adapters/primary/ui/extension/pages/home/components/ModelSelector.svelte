<script lang="ts">
  import { Select } from '../../../../shared/components';
  import { getModelsStateContext } from '../../../../shared/context';

  interface Props {
    value: string;
    provider?: string;
    onchange?: (value: string) => void;
    disabled?: boolean;
  }

  const { value, provider, onchange, disabled = false }: Props = $props();

  const models = getModelsStateContext();

  const providerModels = $derived(models.modelsFor(provider ?? 'google'));
  const isDisabled = $derived(disabled || providerModels.length === 0);

  const options = $derived(
    isDisabled
      ? [{ value: '', label: '—', disabled: true, hidden: true }]
      : providerModels.map((m) => ({
          value: m.id,
          label: m.name !== m.id ? `${m.name} (${m.id})` : m.id,
        })),
  );
</script>

<Select
  id="model-select"
  label="Model"
  value={isDisabled ? '' : value}
  {options}
  disabled={isDisabled}
  onchange={onchange}
/>
