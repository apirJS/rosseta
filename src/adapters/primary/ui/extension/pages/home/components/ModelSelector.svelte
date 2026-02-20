<script lang="ts">
  import { Select } from '../../../../shared/components';
  import { ProviderRegistry } from '../../../../../../../core/domain/provider/ProviderRegistry';
  import type { Provider } from '../../../../../../../core/domain/credential/Provider';

  interface Props {
    value: string;
    provider?: Provider;
    onchange?: (value: string) => void;
  }

  const { value, provider, onchange }: Props = $props();

  const options = $derived.by(() => {
    const activeProvider = provider ?? 'gemini';
    return ProviderRegistry.getModelsForProvider(activeProvider).map((m) => ({
      value: m.id,
      label: m.name,
    }));
  });

  const effectiveValue = $derived.by(() => {
    const activeProvider = provider ?? 'gemini';
    const match = options.find((o) => o.value === value);
    if (match) return value;
    return ProviderRegistry.getDefaultModelId(activeProvider);
  });

  // Auto-select default model when current value doesn't match provider
  $effect(() => {
    if (effectiveValue !== value && options.length > 0) {
      onchange?.(effectiveValue);
    }
  });

  function handleChange(newValue: string) {
    onchange?.(newValue);
  }
</script>

<Select
  id="model-select"
  label="Model"
  value={effectiveValue}
  {options}
  onchange={handleChange}
/>
